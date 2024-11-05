// src/config/acbrboleto.js
const path = require('path');
const fs = require('fs');
const ffi = require('ffi-napi');
const ref = require('ref-napi');

// Singleton para garantir uma única instância da biblioteca
let libInstance = null;

const BUFFER_LEN = 1024;

function initializeLib() {
    if (libInstance) return libInstance;

    const pathLib = path.join(__dirname, '../lib/libacbrboleto64.so');
    const configPath = path.join(__dirname, '../../ACBrBoleto.ini');
    const cryptKey = '';

    if (!fs.existsSync(pathLib)) {
        throw new Error(`Arquivo da biblioteca não encontrado: ${pathLib}`);
    }

    if (!fs.existsSync(configPath)) {
        throw new Error(`Arquivo de configuração não encontrado: ${configPath}`);
    }

    const tint = ref.refType('int');
    const tchar = ref.refType('string');

    libInstance = {
        lib: ffi.Library(pathLib, {
            'Boleto_Inicializar': ['int', ['string', 'string']],
            'Boleto_Finalizar': ['int', []],
            'Boleto_ConfigurarDados': ['int', ['string']],
            'Boleto_IncluirTitulos': ['int', ['string', 'string']],
            'Boleto_SalvarPDF': ['int', [tchar, tint]],
            'Boleto_LimparLista': ['int', []],
            'Boleto_TotalTitulosLista': ['int', []],
            'Boleto_ConfigLer': ['int', ['string']],
            'Boleto_ConfigGravar': ['int', ['string']],
            'Boleto_SetDiretorioArquivo': ['int', ['string', 'string']],
            'Boleto_UltimoRetorno': ['int', [tchar, tint]],
            'Boleto_SelecionaBanco': ['int', ['string']],
            'Boleto_ConfigLerValor': ['int', ['string', 'string', tchar, tint]],
            'Boleto_ConfigGravarValor': ['int', ['string', 'string', 'string']],
            'Boleto_Nome': ['int', [tchar, tint]],
            'Boleto_Versao': ['int', [tchar, tint]],
            'Boleto_GerarPDF': ['int', []],
            'Boleto_GerarRemessa': ['int', ['string', 'int', 'string']],
            'Boleto_LerRetorno': ['int', ['string', 'string']],
            'Boleto_ObterRetorno': ['int', ['string', 'string', tchar, tint]],
            'Boleto_ListaBancos': ['int', [tchar, tint]],
            'Boleto_ListaOcorrencias': ['int', [tchar, tint]],
            'Boleto_ListaOcorrenciasEX': ['int', [tchar, tint]],
            'Boleto_ListaCaractTitulo': ['int', [tchar, tint]],
            'Boleto_TamNossoNumero': ['int', ['string', 'string', 'string']],
            'Boleto_CodigosMoraAceitos': ['int', [tchar, tint]],
            'Boleto_MontarNossoNumero': ['int', ['int', tchar, tint]],
            'Boleto_RetornaLinhaDigitavel': ['int', ['int', tchar, tint]],
            'Boleto_RetornaCodigoBarras': ['int', ['int', tchar, tint]],
            'Boleto_EnviarBoleto': ['int', ['int', tchar, tint]],
        }),
        configPath,
        cryptKey,
        BUFFER_LEN
    };

    return libInstance;
}

module.exports = initializeLib();