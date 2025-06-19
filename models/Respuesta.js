const mongoose = require('mongoose');

const respuestaSchema = new mongoose.Schema({
  encuesta: { type: mongoose.Schema.Types.ObjectId, ref: 'Encuesta', required: true },
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  respuestas: [{
    preguntaId: { type: mongoose.Schema.Types.ObjectId, required: true },
    respuesta: mongoose.Schema.Types.Mixed
  }],
  fecha: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Respuesta', respuestaSchema);
