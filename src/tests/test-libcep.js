// src/tests/test-library.js
// xvfb-run -a node src/tests/test-libcep.js   // fabiano rode isso para testar

const path = require('path');
const fs = require('fs');
const ffi = require('ffi-napi');
const ref = require('ref-napi');

function testLibrary() {
    console.log('Starting library test...');

    // 1. Test file existence
    const libPath = path.join(__dirname, '../lib/libacbrcep64.so');
    const configPath = path.join(__dirname, '../../ACBrCep.ini');

    console.log('Checking files...');
    console.log(`Library path: ${libPath}`);
    console.log(`Config path: ${configPath}`);

    if (!fs.existsSync(libPath)) {
        throw new Error(`Library not found at: ${libPath}`);
    }
    console.log('✓ Library file found');

    if (!fs.existsSync(configPath)) {
        throw new Error(`Config file not found at: ${configPath}`);
    }
    console.log('✓ Config file found');

    // 2. Test library loading
    try {
        console.log('Attempting to load library...');
        const tint = ref.refType('int');
        const tchar = ref.refType('string');

        const lib = ffi.Library(libPath, {
            CEP_Inicializar: ['int', ['string', 'string']],
            CEP_Finalizar: ['int', []],
            CEP_BuscarPorCEP: ['int', ['string', tchar, tint]]
        });
        console.log('✓ Library loaded successfully');

        // 3. Test initialization
        console.log('Testing initialization...');
        const initResult = lib.CEP_Inicializar(configPath, '');
        console.log(`Initialization result: ${initResult}`);

        if (initResult === 0) {
            console.log('✓ Library initialized successfully');

            // 4. Test finalization
            const finalizeResult = lib.CEP_Finalizar();
            console.log(`Finalization result: ${finalizeResult}`);

            if (finalizeResult === 0) {
                console.log('✓ Library finalized successfully');
            } else {
                throw new Error(`Failed to finalize library. Code: ${finalizeResult}`);
            }
        } else {
            throw new Error(`Failed to initialize library. Code: ${initResult}`);
        }

    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    }
}

testLibrary();