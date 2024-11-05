#!/usr/bin/env node

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cepRoutes = require('./routes/cep');
const boletoRoutes = require('./routes/boleto');

const app = express();
const PORT = process.env.PORT || 5641;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK' });
});

app.use('/api', cepRoutes);
app.use((req, res, next) => {
    console.log('Request:', {
        method: req.method,
        path: req.path,
        body: req.body
    });
    next();
});
app.use('/api', boletoRoutes);

const cleanupAndExit = () => {
    console.log('Encerrando servidor...');
    try {
        const { lib } = require('./config/acbrcep');
        if (lib) {
            try {
                lib.CEP_Finalizar();
            } catch (err) {
                console.error('Erro ao finalizar CEP:', err);
            }
        }

        const { lib: boletoLib } = require('./config/acbrboleto');
        if (boletoLib) {
            try {
                boletoLib.Boleto_Finalizar();
            } catch (err) {
                console.error('Erro ao finalizar Boleto:', err);
            }
        }
    } catch (error) {
        console.error('Erro ao limpar recursos:', error);
    }
    process.exit(0);
};

process.on('SIGTERM', cleanupAndExit);
process.on('SIGINT', cleanupAndExit);

app.listen(PORT, (error) => {
    if (error) {
        console.error('Erro ao iniciar servidor:', error);
        process.exit(1);
    }
    console.log(`Servidor esta rodando na porta ${PORT}`);
}).on('error', (error) => {
    console.error('Erro servidor:', error);
    process.exit(1);
});

process.on('uncaughtException', (error) => {
    console.error('Erro não capturado:', error);
    cleanupAndExit();
});