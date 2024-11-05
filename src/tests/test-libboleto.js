// src/tests/test-libboleto.js
const path = require('path');
const fs = require('fs');
const ffi = require('ffi-napi');
const ref = require('ref-napi');

const LIB_PATH = path.join(__dirname, '../lib/libacbrboleto64.so');
const CONFIG_PATH = path.join(__dirname, '../../ACBrBoleto.ini');
const TITULO_CONFIG = 'titulos.ini';
const CEDENTE_CONFIG = 'Cedente.ini';
const TITULOS_CONFIG = 'Cedente_Titulos.ini';

function testBoletoLibrary() {
    console.log('Iniciando testes na biblioteca de boleto...');
    checkFiles();
    const lib = loadLibrary();
    initializeLibrary(lib, CONFIG_PATH);
    //testConfigLerValor(lib);
    testLimparTitulos(lib);
    testConfigGravarValor(lib, 'BoletoCedenteConfig', 'Nome', 'Banco da Gente');
    testConfigGravarValor(lib, 'BoletoCedenteConfig', 'CNPJCPF', '17361356000153');
    testConfigGravarValor(lib, 'BoletoCedenteConfig', 'Conta', '123456');
    testConfigGravarValor(lib, 'BoletoCedenteConfig', 'ContaDigito', '7');
    testConfigGravarValor(lib, 'BoletoCedenteConfig', 'Agencia', '0234');
    testConfigGravarValor(lib, 'BoletoCedenteConfig', 'AgenciaDigito', '1');
    testIncluirTitulos(lib, TITULOS_CONFIG);
    //testConfigImportar(lib);
    testConfigExportar(lib);
    testGerarPDF(lib);
    finalizeLibrary(lib);
}

function checkFiles() {
    console.log('Checando arquivos...');
    checkFile(LIB_PATH, 'Arquivo da biblioteca');
    checkFile(CONFIG_PATH, 'Arquivo de configuração');
}

function loadLibrary() {
    console.log('Lendo biblioteca...');
    return ffi.Library(LIB_PATH, defineLibraryFunctions());
}

function initializeLibrary(lib, configPath) {
    console.log('Inicializando teste...');
    const initResult = lib.Boleto_Inicializar(configPath, '');
    if (initResult !== 0) throwError(lib, 'Falha ao inicializar a biblioteca');
    console.log('✓ Biblioteca inicializada com sucesso');
}

function testConfigLerValor(lib) {
    console.log('Testando ConfigLer...');
    const configLerResult = lib.Boleto_ConfigLer(CONFIG_PATH);
    if (configLerResult !== 0) throwError(lib, 'Erro ao ler configuração');
    console.log('✓ Configuração lida com sucesso');
    readConfigValues(lib);
}

function testConfigGravar(lib) {
    console.log('Testando ConfigGravar...');
    const gravarResult = lib.Boleto_ConfigGravar(CONFIG_PATH);
    if (gravarResult !== 0) throwError(lib, 'Erro ao gravar configuração');
    console.log('✓ Configuração gravada com sucesso');
}

function testConfigGravarValor(lib, secao, chave, valor) {
    console.log(`Testando ConfigGravarValor para [${secao}]${chave}...`);

    if (hasConfigKey(lib, secao, chave)) {
        const gravarValorResult = lib.Boleto_ConfigGravarValor(secao, chave, valor);
        if (gravarValorResult !== 0) throwError(lib, 'Erro ao gravar valor específico');
        console.log(`✓ Valor [${secao}]${chave} = ${valor} gravado com sucesso`);
    } else {
        console.log(`Não foi possível gravar o valor [${secao}]${chave} = ${valor} pois a seção não existe no arquivo de configuração.`);
    }
}

function hasConfigKey(lib, section, key) {
    const bufferLen = 1024;
    const valorBuffer = Buffer.alloc(bufferLen);
    const valorSizeBuffer = ref.alloc('int', bufferLen);
    const lerValorResult = lib.Boleto_ConfigLerValor(section, key, valorBuffer, valorSizeBuffer);
    return lerValorResult === 0;
}

function testLimparTitulos(lib) {
    console.log('Testando limpeza de títulos...');
    const limparResult = lib.Boleto_LimparLista();
    if (limparResult !== 0) throwError(lib, 'Erro ao limpar lista de títulos');

    const totalResult = lib.Boleto_TotalTitulosLista();
    if (totalResult !== 0) throwError(lib, 'Lista de títulos não está vazia após limpeza');

    console.log('✓ Lista de títulos limpa com sucesso');
}


function testIncluirTitulos(lib, titulosConfig) {
    console.log('Incluindo títulos...');
    fs.writeFileSync(titulosConfig, getTitulosConfig());
    const incluirResult = lib.Boleto_IncluirTitulos(titulosConfig, '');
    if (incluirResult !== 0) throwError(lib, 'Erro na inclusão de títulos');
    console.log('✓ Títulos incluídos com sucesso');
    const totalResult = lib.Boleto_TotalTitulosLista();
    console.log('Total de títulos:', totalResult);
    //fs.unlinkSync(titulosConfig);
}

function testGerarPDF(lib) {
    console.log('Verificando configuração do PDF...');
    const pdfPath = readConfigValue(lib, 'BoletoBancoFCFortesConfig', 'NomeArquivo');
    console.log('PDF será gerado em:', pdfPath);
    console.log('Gerando PDF...');
    const pdfResult = lib.Boleto_GerarPDF();
    if (pdfResult !== 0) throwError(lib, 'Erro Gerando PDF');
    console.log('✓ PDF gerado com sucesso');
}

function finalizeLibrary(lib) {
    const finalizeResult = lib.Boleto_Finalizar();
    if (finalizeResult !== 0) throwError(lib, 'Falha ao finalizar a biblioteca');
    console.log('✓ Biblioteca finalizada com sucesso');
}

function defineLibraryFunctions() {
    // Definições dos tipos
    const tint = ref.refType('int');
    return {
        'Boleto_Inicializar': ['int', ['string', 'string']],
        'Boleto_Finalizar': ['int', []],
        'Boleto_UltimoRetorno': ['int', ['pointer', tint]],
        'Boleto_Nome': ['int', ['pointer', tint]],
        'Boleto_Versao': ['int', ['pointer', tint]],
        'Boleto_ConfigLer': ['int', ['string']],
        'Boleto_ConfigGravar': ['int', ['string']],
        'Boleto_ConfigLerValor': ['int', ['string', 'string', 'pointer', tint]],
        'Boleto_ConfigGravarValor': ['int', ['string', 'string', 'string']],
        'Boleto_IncluirTitulos': ['int', ['string', 'string']],
        'Boleto_TotalTitulosLista': ['int', []],
        'Boleto_LimparLista': ['int', []],
        'Boleto_SelecionaBanco': ['int', ['string']],
        'Boleto_GerarPDF': ['int', []],
        'Boleto_ConfigImportar': ['int', ['string']],
        'Boleto_ConfigExportar': ['int', ['pointer', tint]],
    };
}

function checkFile(filePath, message) {
    if (!fs.existsSync(filePath)) throw new Error(`Arquivo não encontrado: ${filePath}`);
    console.log(`✓ ${message} encontrado`);
}

function throwError(lib, message) {
    const bufferLen = 1024;
    const responseBuffer = Buffer.alloc(bufferLen);
    const sizeBuffer = ref.alloc('int', bufferLen);
    const errorCode = lib.Boleto_UltimoRetorno(responseBuffer, sizeBuffer);
    let errorMessage = `${message}: ${responseBuffer.toString().trim()}`;
    if (errorCode !== 0) {
        errorMessage += ` (Código de erro: ${errorCode})`;
    }
    console.error(errorMessage);
    //throw new Error('errorMessage');
}

function readConfigValues(lib) {
    const sections = ['Banco', 'Cedente', 'Conta'];
    const keys = ['Numero', 'Nome', 'Agencia'];
    for (let section of sections) {
        for (let key of keys) {
            const value = readConfigValue(lib, section, key);
            console.log(`Valor [${section}]${key}: ${value}`);
        }
    }
}

function readConfigValue(lib, section, key) {
    const bufferLen = 1024;
    const valorBuffer = Buffer.alloc(bufferLen);
    const valorSizeBuffer = ref.alloc('int', bufferLen);
    const lerValorResult = lib.Boleto_ConfigLerValor(section, key, valorBuffer, valorSizeBuffer);
    if (lerValorResult !== 0) return 'Não encontrado';
    return valorBuffer.toString().trim();
}

function getTitulosConfig() {
    return `[Titulo1]
        NumeroDocumento=123
        NossoNumero=99999
        Carteira=17
        ValorDocumento=100.00
        Vencimento=30/12/2024
        DataDocumento=30/11/2024
        DataProcessamento=30/11/2024
        LocalPagamento=Pagável em qualquer agência bancária
        Sacado.NomeSacado=Nome do Cliente
        Sacado.CNPJCPF=12345678900
        Sacado.Pessoa=1
        Sacado.Logradouro=Rua Teste
        Sacado.Numero=123
        Sacado.Bairro=Centro
        Sacado.Cidade=São Paulo
        Sacado.UF=SP
        Sacado.CEP=12345678`;
}

function testConfigImportar(lib) {
    console.log('Testando ConfigImportar...');
    const importResult = lib.Boleto_ConfigImportar(CONFIG_PATH);
    if (importResult !== 0) throwError(lib, 'Erro ao importar configuração');
    console.log('✓ Configuração importada com sucesso');
}

function testConfigExportar(lib) {
    console.log('Testando ConfigExportar...');
    const bufferLen = 32768;
    const configBuffer = Buffer.alloc(bufferLen);
    const sizeBuffer = ref.alloc('int', bufferLen);

    const exportResult = lib.Boleto_ConfigExportar(configBuffer, sizeBuffer);
    if (exportResult !== 0) throwError(lib, 'Erro ao exportar configuração');

    const configStr = configBuffer.toString().trim();
    fs.writeFileSync('exportado.ini', configStr);
    console.log('✓ Configuração exportada com sucesso para exportado.ini');
}

testBoletoLibrary();