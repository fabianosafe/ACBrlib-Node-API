// src/config/acbrcep.js
const path = require('path');
const fs = require('fs');
const ffi = require('ffi-napi');
const ref = require('ref-napi');

// Singleton para garantir uma única instância da biblioteca
let libInstance = null;

function initializeLib() {
    if (libInstance) return libInstance;

    const pathLib = path.join(__dirname, '../lib/libacbrcep64.so');
    const configPath = path.join(__dirname, '../../ACBrCep.ini');
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
            CEP_Inicializar: ['int', ['string', 'string']],
            CEP_Finalizar: ['int', []],
            CEP_BuscarPorCEP: ['int', ['string', tchar, tint]],
        }),
        configPath,
        cryptKey
    };

    return libInstance;
}

module.exports = initializeLib();