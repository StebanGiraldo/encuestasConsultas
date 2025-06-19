const mongoose = require('mongoose');

const usuarioSchema = new mongoose.Schema({
  nombre: { type: String, required: true }, // Nombre o razón social
  identificacion: { type: String, required: true, unique: true },
  tipoOrganizacion: { type: String }, // Solo para organizaciones
  direccion: { type: String },
  telefono: { type: String },
  edad: { type: Number }, // Solo para ciudadanos
  sexo: { type: String, enum: ['Masculino', 'Femenino', 'Otro'] }, // Solo para ciudadanos
  departamento: { type: String }, // Solo para ciudadanos
  ocupacion: { type: String }, // Solo para ciudadanos
  email: { type: String, required: true, unique: true },
  contrasena: { type: String, required: true },
  rol: { 
    type: String, 
    enum: ['administrador', 'entidad', 'usuario'], 
    default: 'usuario' 
  }
});

module.exports = mongoose.model('Usuario', usuarioSchema);
