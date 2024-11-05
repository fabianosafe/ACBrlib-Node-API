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
        ContaDigito: banco.digitoConta,
        Convenio: cedente.convenio
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
    console.log('Iniciando generateBoleto:', new Date().toISOString());
    console.log('Payload recebido:', JSON.stringify(req.body, null, 2));

    const { operacao, banco, cedente, titulos } = req.body;

    // Verifica logo do banco
    const dirLogo = path.resolve(path.join(process.cwd(), 'logos'));
    const logoFile = path.join(dirLogo, `${banco.numero.padStart(3, '0')}.png`);

    console.log('Verificando logo:', {
        dirLogo,
        logoFile,
        exists: fs.existsSync(logoFile)
    });

    if (!fs.existsSync(dirLogo) || !fs.existsSync(logoFile)) {
        console.error('Logo não encontrado:', logoFile);
        return res.status(400).json({
            success: false,
            error: `Logo do banco não encontrado: ${logoFile}`
        });
    }

    let initialized = false;
    let tempTitulosFile = null;
    let tempConfigFile = null;

    try {
        // Cria arquivo de configuração temporário
        tempConfigFile = path.join(os.tmpdir(), `boleto_config_${Date.now()}.ini`);
        console.log('Criando arquivo de configuração temporário:', tempConfigFile);
        fs.writeFileSync(tempConfigFile, createConfigIni(banco, cedente), 'utf8');
        console.log('Arquivo de configuração criado com sucesso');

        // Inicializa biblioteca
        console.log('Inicializando biblioteca com config:', tempConfigFile);
        const initResult = lib.Boleto_Inicializar(tempConfigFile, cryptKey);
        console.log('Resultado da inicialização:', initResult);

        if (initResult !== 0) {
            const erro = getUltimoRetorno();
            console.error('Erro na inicialização:', erro);
            return res.status(500).json({
                success: false,
                error: erro
            });
        }
        initialized = true;
        console.log('Biblioteca inicializada com sucesso');

        // Limpa lista
        console.log('Limpando lista de títulos');
        const clearResult = lib.Boleto_LimparLista();
        console.log('Resultado da limpeza:', clearResult);

        if (clearResult !== 0) {
            const erro = getUltimoRetorno();
            console.error('Erro ao limpar lista:', erro);
            return res.status(500).json({
                success: false,
                error: erro
            });
        }

        // Inclui títulos
        console.log('Formatando títulos');
        const titulosFormatados = titulos.map(titulo => ({
            ...titulo,
            sacado: {
                ...titulo.sacado,
                cnpjCpf: formatDocumento(titulo.sacado.cnpjCpf),
                cep: formatCEP(titulo.sacado.cep)
            }
        }));

        tempTitulosFile = path.join(os.tmpdir(), `boleto_titulos_${Date.now()}.ini`);
        console.log('Criando arquivo de títulos temporário:', tempTitulosFile);
        fs.writeFileSync(tempTitulosFile, createTitulosIni(titulosFormatados), 'utf8');
        console.log('Arquivo de títulos criado');

        console.log('Incluindo títulos');
        const includeResult = lib.Boleto_IncluirTitulos(tempTitulosFile, operacao === 'pdf' ? 'P' : '');
        console.log('Resultado da inclusão:', includeResult);

        if (includeResult !== 0) {
            const erro = getUltimoRetorno();
            console.error('Erro ao incluir títulos:', erro);
            return res.status(500).json({
                success: false,
                error: erro
            });
        }

        // Verifica quantidade
        const totalTitulos = lib.Boleto_TotalTitulosLista();
        console.log('Total de títulos:', totalTitulos);

        if (totalTitulos !== titulos.length) {
            console.error('Quantidade de títulos divergente:', {
                esperado: titulos.length,
                incluidos: totalTitulos
            });
            return res.status(500).json({
                error: `Quantidade de títulos incluídos (${totalTitulos}) difere do esperado (${titulos.length})`
            });
        }

        // Configura diretório
        const outputDir = os.tmpdir();
        console.log('Configurando diretório de saída:', outputDir);
        lib.Boleto_SetDiretorioArquivo(outputDir, '');

        // Gera PDF
        let pdfData = null;
        if (operacao === 'pdf') {
            console.log('Iniciando geração do PDF');
            const responseBuffer = Buffer.alloc(BUFFER_LEN);
            const sizeBuffer = ref.alloc('int', BUFFER_LEN);

            const pdfResult = lib.Boleto_SalvarPDF(responseBuffer, sizeBuffer);
            console.log('Resultado da geração PDF:', pdfResult);

            if (pdfResult !== 0) {
                const erro = getUltimoRetorno();
                console.error('Erro ao gerar PDF:', erro);
                return res.status(500).json({
                    success: false,
                    error: erro
                });
            }

            pdfData = responseBuffer.toString('base64');
            console.log('PDF gerado com sucesso');
        }

        console.log('Operação concluída com sucesso');
        return res.json({
            success: true,
            data: {
                ...(pdfData ? { pdf: pdfData } : {})
            }
        });

    } catch (error) {
        console.error('Erro na execução:', error);
        return res.status(500).json({
            error: error.message,
            stack: error.stack
        });
    } finally {
        console.log('Executando limpeza final');
        if (initialized) {
            try {
                console.log('Finalizando biblioteca');
                lib.Boleto_Finalizar();
            } catch (err) {
                console.error('Erro ao finalizar biblioteca:', err);
            }
        }

        // Remove arquivos temporários
        [tempTitulosFile, tempConfigFile].forEach(file => {
            if (file && fs.existsSync(file)) {
                try {
                    console.log('Removendo arquivo temporário:', file);
                    fs.unlinkSync(file);
                } catch (err) {
                    console.error('Erro ao remover arquivo temporário:', err);
                }
            }
        });
        console.log('Operação finalizada:', new Date().toISOString());
    }
};

module.exports = {
    generateBoleto
};