/**
 * Estado compartido entre el escenario (que lee el scroll) y el mundo 3D (que
 * lo dibuja). `u` es la posición del plano en la cámara: 0 = portada,
 * 1 a 5 = los cinco capítulos de la noche.
 */
export const bus = { u: 0 }
