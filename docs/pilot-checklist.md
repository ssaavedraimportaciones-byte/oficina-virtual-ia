# SafeCheck AI — Checklist Piloto Industrial

**Versión:** 1.0 — Mayo 2026  
**Alcance:** Piloto minería Chile — 1 empresa mandante + 1-2 contratistas

---

## 1. ONBOARDING EMPRESA

### 1.1 Configuración inicial (hacer ANTES del primer turno)

- [ ] Crear empresa mandante en `/companies` (RUT, nombre, tipo MANDANTE)
- [ ] Crear empresa contratista en `/companies` (RUT, nombre, tipo CONTRATISTA)
- [ ] Crear usuarios:
  - [ ] Al menos 1 PREVENTIONIST (empresa mandante)
  - [ ] Al menos 1 SUPERVISOR (empresa contratista)
  - [ ] Al menos 1 CONTRACT_ADMIN (empresa contratista)
  - [ ] Usuarios WORKER según nómina operacional
- [ ] Registrar trabajadores de campo en `/workers` (RUT, cargo, certificaciones)
- [ ] Verificar que todos los usuarios reciben correo de bienvenida y pueden hacer login
- [ ] Activar MFA en cuentas SYSTEM_ADMIN y CONTRACT_ADMIN (obligatorio)

### 1.2 Verificación de acceso por rol

| Rol | Puede crear doc | Puede aprobar | Puede ver todas empresas |
|---|---|---|---|
| WORKER | ✅ | ❌ | ❌ |
| SUPERVISOR | ✅ | ✅ (parcial) | ❌ |
| PREVENTIONIST | ✅ | ✅ | ❌ (solo su empresa) |
| CONTRACT_ADMIN | ✅ | ✅ | ❌ (solo su empresa) |
| MANAGER | ❌ | ✅ | ✅ |
| AUDITOR | ❌ | ❌ | ✅ (solo lectura) |
| SYSTEM_ADMIN | ✅ | ✅ | ✅ |

---

## 2. CAPACITACIÓN USUARIOS

### 2.1 Capacitación obligatoria antes del piloto

**Duración recomendada:** 2 horas (presencial o remota)

- [ ] Explicar flujo de documento: DRAFT → SCANNED → AI_REVIEW → PENDING_SIGNATURE → PENDING_APPROVAL → APPROVED
- [ ] Demostrar creación de ART desde tablet (paso a paso)
- [ ] Demostrar firma digital en pantalla
- [ ] Demostrar cómo aprobar/observar un documento
- [ ] Demostrar consulta de historial de versiones
- [ ] Explicar qué hace la IA (solo recomienda, nunca aprueba)
- [ ] Explicar geofencing (si aplica): el sistema verifica GPS pero el humano decide
- [ ] Recordar: **la IA ayuda, la decisión final siempre es del prevencionista/supervisor**

### 2.2 Material de apoyo (preparar antes del piloto)

- [ ] Guía de usuario rápida (1 página) por rol
- [ ] Póster en sala de reunión: flujo de aprobación
- [ ] Número de soporte técnico visible en pantalla de login
- [ ] Contacto de emergencia impreso en tabletas

---

## 3. SOP USO EN TABLETS

### 3.1 Especificaciones mínimas tablet

- Android 11+ o iOS 14+
- Cámara trasera 8MP mínimo (para escaneo de documentos físicos)
- GPS activo
- Conexión a red (WiFi empresa o datos 4G/LTE)
- Batería cargada al inicio de turno

### 3.2 Procedimiento inicio de turno

1. Cargar tablet completamente (100%) o asegurar cargador en área de trabajo
2. Verificar conectividad: abrir Safari/Chrome y cargar la URL de SafeCheck
3. Login con credenciales personales (no compartir contraseñas)
4. Si aparece solicitud de MFA → ingresar código de la app autenticadora
5. Verificar que el nombre correcto aparece en la esquina superior

### 3.3 Creación de ART/AST en terreno

1. Abrir `/documents/new` en tablet
2. Seleccionar tipo de documento (ART, AST, DET, etc.)
3. Si escaneas un documento físico: usar botón "Escanear" → apuntar cámara al documento físico
4. Esperar revisión IA (15-60 segundos según conexión) → la IA extrae campos automáticamente
5. **Revisar SIEMPRE todos los campos extraídos** — la IA puede equivocarse
6. Completar campos faltantes manualmente (marcados en rojo)
7. Agregar riesgos y controles según la tarea real
8. Enviar a firma → que cada trabajador involucrado firme en su tablet o en la tablet pasada
9. Enviar a aprobación → esperar confirmación del prevencionista

### 3.4 Firma digital en tablet

- Cada trabajador firma con su huella o trazo en pantalla
- El sistema registra: timestamp, GPS, dispositivo
- **Nunca firmar por otra persona**
- Si el trabajador no tiene cuenta: registrarlo en `/workers` como trabajador de campo

---

## 4. CONTINGENCIA OFFLINE

### 4.1 Qué hacer si no hay conectividad

SafeCheck AI requiere conexión para funcionar. En caso de pérdida de red:

1. **Documento físico como respaldo**: completar ART/AST en papel (tener formularios impresos disponibles SIEMPRE)
2. Anotar hora y firmantes en el papel
3. Cuando se recupere la conexión: escanear el documento físico desde `/documents/new`
4. El OCR extraerá los campos automáticamente
5. Revisar y corregir campos, luego seguir flujo normal de aprobación

### 4.2 Formularios de emergencia (imprimir y guardar en faena)

- [ ] ART en blanco (10 copias por faena)
- [ ] AST en blanco (5 copias)
- [ ] Charla de seguridad en blanco (5 copias)
- [ ] Lista de asistencia en blanco (10 copias)

### 4.3 Zonas sin señal conocidas (completar por faena)

| Zona | Tipo de falla | Workaround |
|---|---|---|
| (completar) | WiFi / 4G / ambos | (documento físico) |

---

## 5. QUÉ HACER SI OCR FALLA

Síntomas: campos vacíos después del escaneo, confianza muy baja (<50%), error en pantalla.

### 5.1 Causas comunes

- Documento físico muy arrugado o manchado
- Mala iluminación al escanear
- Letra cursiva o difícil de leer
- OCR de Azure no disponible (revisar ANTHROPIC_API_KEY / AZURE_DOCUMENT_INTELLIGENCE_KEY)

### 5.2 Pasos a seguir

1. Reintentar escaneo con mejor iluminación y documento plano
2. Si falla de nuevo: completar todos los campos MANUALMENTE (botón "Ingresar manualmente")
3. El campo de confianza quedará vacío — esto es normal para ingreso manual
4. Continuar flujo normal: el prevencionista revisará todos los campos antes de aprobar
5. Reportar el incidente al administrador del sistema (incluir: folio del documento, hora, tipo de falla)

---

## 6. QUÉ HACER SI QR FALLA

El código QR del PDF final sirve para verificar autenticidad del documento.

### 6.1 El QR no aparece en el PDF

- El PDF puede generarse antes de que el job termine. Esperar 2-3 minutos y recargar el documento.
- Si persiste: contactar soporte técnico.

### 6.2 El QR no pasa la verificación en terreno

- Verificar que el PDF es el original (no una copia de pantalla)
- Ingresar manualmente la URL de verificación en `/verify/[código]`
- Si la URL no funciona: el documento puede estar en estado DRAFT o REJECTED

### 6.3 Verificación manual

Para verificar un documento sin QR: ingresar el folio (ej. SC-2026-000001) directamente en el sistema.

---

## 7. RECUPERACIÓN DE INCIDENTES

### 7.1 Usuario no puede acceder al sistema

1. Verificar contraseña (usar "Olvidé mi contraseña" si está configurado)
2. Si el usuario fue desactivado: contactar CONTRACT_ADMIN de su empresa
3. Si hay problema de MFA: contactar SYSTEM_ADMIN para desactivar MFA temporalmente

### 7.2 Documento aprobado por error

1. Un documento APPROVED no se puede modificar (por diseño legal)
2. Crear un nuevo documento corrigiendo el error
3. Archivar el documento incorrecto con comentario de observación
4. Registrar el incidente en el log de auditoría con nota manual

### 7.3 Sistema no disponible (Vercel / DB down)

1. Activar contingencia offline (punto 4)
2. Contactar administrador SafeCheck: admin@safecheck.app
3. Revisar status de Vercel: https://www.vercel-status.com
4. Revisar status de Neon DB (si aplica)
5. ETA de recuperación: registrar en canal de comunicación de la faena

---

## 8. EXPORT AUDITORÍA DIRECCIÓN DEL TRABAJO (DT)

### 8.1 Preparación para fiscalización DT

En Chile, la DT puede solicitar registros de seguridad durante inspecciones.

**SafeCheck entrega:**
- Log de auditoría completo (quién hizo qué, cuándo, desde dónde)
- Documentos aprobados con firma digital y QR verificable
- PDF con hash de integridad del documento
- Historial de versiones del documento

### 8.2 Exportar registros

1. Ir a `/audit` en el panel de administración
2. Filtrar por empresa, fecha y tipo de documento
3. Exportar como CSV o JSON (disponible para AUDITOR y SYSTEM_ADMIN)
4. Los documentos PDF con QR se pueden imprimir directamente

### 8.3 Qué NO puede hacer DT con estos documentos

- No pueden modificar los registros (inmutables en DB con RLS PostgreSQL)
- No pueden ver contraseñas ni datos de autenticación
- No pueden acceder al sistema directamente (deben solicitar exportación)

---

## 9. CHECKLIST LEGAL CHILE

### 9.1 Normativa aplicable

- [ ] DS 594/1999 — Condiciones sanitarias y ambientales básicas en los lugares de trabajo
- [ ] DS 132/2004 — Reglamento de Seguridad Minera (para faenas mineras)
- [ ] Ley 16.744 — Accidentes del Trabajo y Enfermedades Profesionales
- [ ] DS 40/1969 — Prevención de Riesgos Profesionales
- [ ] NCh 436 — Prevención de accidentes del trabajo

### 9.2 Documentos que SafeCheck genera y cumple con normativa

| Documento | Normativa | Válido DT |
|---|---|---|
| ART | DS 132, Art. 191 | ✅ con firma digital |
| AST | DS 132 | ✅ con firma digital |
| DET | DS 132 | ✅ |
| Charla de seguridad | DS 40, Art. 21 | ✅ con lista asistencia |
| LOTO | NCh 3350 | ✅ |
| Permiso de trabajo en altura | DS 594, Art. 103g | ✅ |

### 9.3 Firma digital — validez legal Chile

La firma digital capturada en SafeCheck constituye evidencia de consentimiento con:
- Timestamp servidor certificado
- IP del dispositivo
- Coordenadas GPS (cuando disponible)
- Hash de integridad del documento
- AuditLog inmutable

Para mayor certeza legal, coordinar con abogado si se requiere firma electrónica avanzada (FEA) con certificado emitido por prestador acreditado.

### 9.4 Retención de documentos

- Mínimo legal: 5 años (DS 594)
- Recomendado SafeCheck: indefinido (bajo costo de almacenamiento)
- Los documentos CLOSED y ARCHIVED no pueden ser eliminados por usuarios del sistema

---

## 10. CHECKLIST DE GO-LIVE PILOTO

### Infraestructura (checklist técnico)

- [ ] Vercel deploy exitoso — URL de staging operativa
- [ ] Smoke tests pasan (11/11)
- [ ] Neon DB con backup automático configurado
- [ ] Variables de entorno en Vercel verificadas
- [ ] Sentry configurado y recibiendo eventos de prueba
- [ ] Email enviado correctamente (prueba con admin@empresa.cl)
- [ ] Redis configurado (rate limiting + cache)

### Operacional

- [ ] Al menos 5 usuarios creados y con acceso verificado
- [ ] Al menos 1 documento demo creado y aprobado exitosamente
- [ ] Todos los aprobadores conocen el flujo de aprobación
- [ ] Formularios físicos de contingencia impresos y en faena
- [ ] Contacto de soporte técnico conocido por todos los usuarios
- [ ] Backup manual realizado antes del go-live: `npm run db:backup`

### Legal y RRHH

- [ ] Usuarios firmaron términos de uso del sistema
- [ ] Política de privacidad comunicada
- [ ] Procedimiento de firma digital informado (qué implica firmar)
- [ ] Responsable designado por empresa mandante
- [ ] Responsable designado por empresa contratista

---

*SafeCheck AI — Herramienta de apoyo a la gestión documental de seguridad en faenas mineras.*  
*La IA solo recomienda. La aprobación final siempre es responsabilidad de una persona autorizada.*
