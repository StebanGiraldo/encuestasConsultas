const mongoose = require('mongoose');

// Esquema para cada pregunta de la encuesta
const preguntaSchema = new mongoose.Schema({
  texto: { type: String, required: true },
  tipo: { type: String, enum: ['abierta', 'cerrada', 'escala'], required: true },
  opciones: [{ type: String }],
  escala: {
    min: Number,
    max: Number
  }
}, { _id: true }); // Asegura que cada pregunta tenga un _id

// Esquema principal para la encuesta
const encuestaSchema = new mongoose.Schema({
  titulo: { type: String, required: true },
  descripcion: { type: String },
  tipoEncuesta: { type: String, enum: ['abierta', 'cerrada', 'escala'], required: true },
  preguntas: [preguntaSchema],
  fechaCreacion: { type: Date, default: Date.now },
  creadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  // Campos de segmentación
  segmentacion: {
    edad: {
      min: { type: Number },
      max: { type: Number }
    },
    departamento: [{ type: String }],
    ocupacion: [{ type: String }]
  }
});

module.exports = mongoose.model('Encuesta', encuestaSchema);
