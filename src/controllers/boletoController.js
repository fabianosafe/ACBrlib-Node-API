// src/controllers/boletoController.js
const path = require('path');
const fs = require('fs');
const os = require('os');
const ini = require('ini');
const { lib, configPath, cryptKey, BUFFER_LEN } = require('../config/acbrboleto');
const ref = require('ref-napi');

function getUltimoRetorno() {
    const responseBuffer = Buffer.alloc(BUFFER_LEN);
    const sizeBuffer = ref.alloc('int', BUFFER_LEN);
    lib.Boleto_UltimoRetorno(responseBuffer, sizeBuffer);
    return responseBuffer.toString('utf8', 0, ref.deref(sizeBuffer)).trim();
}

function formatCNPJ(cnpj) {
    return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/g, '$1.$2.$3/$4-$5');
}

function formatCPF(cpf) {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/g, '$1.$2.$3-$4');
}

function formatCEP(cep) {
    return cep.replace(/(\d{5})(\d{3})/g, '$1-$2');
}

function formatDocumento(doc) {
    return doc.length === 11 ? formatCPF(doc) : formatCNPJ(doc);
}

function createConfigIni(banco, cedente) {
    const baseConfig = fs.readFileSync(configPath, 'utf8');
    const config = ini.parse(baseConfig);

    config.BoletoBancoConfig = {
        ...config.BoletoBancoConfig,
        TipoCobranca: banco.tipoCobranca,
        Numero: banco.numero
    };

    config.BoletoCedenteConfig = {
        ...config.BoletoCedenteConfig,
        Nome: cedente.nome,
        CNPJCPF: formatDocumento(cedente.cnpjCpf),
        Agencia: banco.agencia,
        AgenciaDigito: banco.digitoAgencia,
        Conta: banco.conta,
        ContaDigito: banco.digitoConta
    };

    return ini.stringify(config);
}

function createTitulosIni(titulos) {
    return titulos.map((titulo, index) => `[Titulo${index + 1}]
NumeroDocumento=${titulo.numeroDocumento}
NossoNumero=${titulo.nossoNumero || ''}
Carteira=${titulo.carteira}
ValorDocumento=${titulo.valor}
Vencimento=${titulo.vencimento}
DataDocumento=${titulo.dataDocumento || new Date().toLocaleDateString('pt-BR')}
DataProcessamento=${new Date().toLocaleDateString('pt-BR')}
LocalPagamento=Pagável em qualquer agência bancária
Sacado.NomeSacado=${titulo.sacado.nome}
Sacado.CNPJCPF=${titulo.sacado.cnpjCpf}
Sacado.Logradouro=${titulo.sacado.logradouro || ''}
Sacado.Numero=${titulo.sacado.numero || ''}
Sacado.Bairro=${titulo.sacado.bairro || ''}
Sacado.Cidade=${titulo.sacado.cidade || ''}
Sacado.UF=${titulo.sacado.uf || ''}
Sacado.CEP=${titulo.sacado.cep || ''}`).join('\n\n');
}

const generateBoleto = async (req, res) => {
    const { operacao, banco, cedente, titulos } = req.body;

    // Verifica logo do banco
    const dirLogo = path.resolve(path.join(process.cwd(), 'logos'));
    const logoFile = path.join(dirLogo, `${banco.numero.padStart(3, '0')}.png`);

    if (!fs.existsSync(dirLogo) || !fs.existsSync(logoFile)) {
        return res.status(400).json({ error: `Logo do banco não encontrado: ${logoFile}` });
    }

    let initialized = false;
    let tempTitulosFile = null;
    let tempConfigFile = null;

    try {
        // Cria arquivo de configuração temporário
        tempConfigFile = path.join(os.tmpdir(), `boleto_config_${Date.now()}.ini`);
        fs.writeFileSync(tempConfigFile, createConfigIni(banco, cedente), 'utf8');

        // Inicializa biblioteca com novo arquivo de configuração
        const initResult = lib.Boleto_Inicializar(tempConfigFile, cryptKey);
        if (initResult !== 0) {
            return res.status(500).json({ error: getUltimoRetorno() });
        }
        initialized = true;

        // Limpa lista
        const clearResult = lib.Boleto_LimparLista();
        if (clearResult !== 0) {
            return res.status(500).json({ error: getUltimoRetorno() });
        }

        // Inclui títulos
        const titulosFormatados = titulos.map(titulo => ({
            ...titulo,
            sacado: {
                ...titulo.sacado,
                cnpjCpf: formatDocumento(titulo.sacado.cnpjCpf),
                cep: formatCEP(titulo.sacado.cep)
            }
        }));

        tempTitulosFile = path.join(os.tmpdir(), `boleto_titulos_${Date.now()}.ini`);
        fs.writeFileSync(tempTitulosFile, createTitulosIni(titulosFormatados), 'utf8');

        const includeResult = lib.Boleto_IncluirTitulos(tempTitulosFile, operacao === 'pdf' ? 'P' : '');
        if (includeResult !== 0) {
            return res.status(500).json({ error: getUltimoRetorno() });
        }

        // Verifica quantidade de títulos
        const totalTitulos = lib.Boleto_TotalTitulosLista();
        if (totalTitulos !== titulos.length) {
            return res.status(500).json({
                error: `Quantidade de títulos incluídos (${totalTitulos}) difere do esperado (${titulos.length})`
            });
        }

        // Configura diretório de saída
        const outputDir = os.tmpdir();
        lib.Boleto_SetDiretorioArquivo(outputDir, '');

        // Gera PDF
        let pdfData = null;
        if (operacao === 'pdf') {
            const responseBuffer = Buffer.alloc(BUFFER_LEN);
            const sizeBuffer = ref.alloc('int', BUFFER_LEN);

            const pdfResult = lib.Boleto_SalvarPDF(responseBuffer, sizeBuffer);
            if (pdfResult !== 0) {
                return res.status(500).json({ error: getUltimoRetorno() });
            }

            pdfData = responseBuffer.toString('base64');
        }

        return res.json({
            success: true,
            data: {
                ...(pdfData ? { pdf: pdfData } : {})
            }
        });

    } finally {
        if (initialized) {
            try {
                lib.Boleto_Finalizar();
            } catch (err) {
                console.error('Erro ao finalizar:', err);
            }
        }

        // Remove arquivos temporários
        [tempTitulosFile, tempConfigFile].forEach(file => {
            if (file && fs.existsSync(file)) {
                try {
                    fs.unlinkSync(file);
                } catch (err) {
                    console.error('Erro ao remover arquivo temporário:', err);
                }
            }
        });
    }
};

module.exports = {
    generateBoleto
};