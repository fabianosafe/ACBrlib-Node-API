// src/controllers/cepController.js
const { lib, configPath, cryptKey } = require('../config/acbrcep');
const ref = require('ref-napi');

const searchCEP = async (req, res) => {
    const { cep } = req.body;

    if (!cep) {
        return res.status(400).json({ error: 'CEP é obrigatório' });
    }

    try {
        const bufLength = 256;
        const responseBuffer = Buffer.alloc(bufLength);
        const sizeBuffer = ref.alloc('int', bufLength);

        let result = lib.CEP_Inicializar(configPath, cryptKey);

        if (result !== 0) {
            throw new Error('Falha ao inicializar ACBrLibCEP');
        }

        result = lib.CEP_BuscarPorCEP(cep, responseBuffer, sizeBuffer);

        if (result !== 0) {
            throw new Error('Falha ao procurar CEP');
        }

        const response = responseBuffer.toString();

        lib.CEP_Finalizar();

        return res.json({ data: response });
    } catch (error) {
        lib.CEP_Finalizar();
        return res.status(500).json({ error: error.message });
    }
};

module.exports = {
    searchCEP
};