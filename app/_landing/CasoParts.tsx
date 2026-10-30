import type { Caso } from './data'

/**
 * Las piezas de un ejemplo en vivo: el teléfono con la conversación y la lista
 * de «Qué hizo el agente». La animación (motion.ts) las busca por sus atributos
 * `data-*` dentro de una sección `[data-caso]`: todos los ejemplos usan este
 * mismo marcado para actuarse igual.
 */

const pad = (n: number) => String(n).padStart(2, '0')

export function CasoPhone({ caso }: { caso: Pick<Caso, 'name' | 'place' | 'messages'> }) {
  return (
    <div className="zv-phone zv-ft-phone" data-reveal-item>
      <div className="zv-ft-head">
        <div className="zv-ft-id">
          <span className="zv-ft-name">{caso.name}</span>
          <span className="zv-ft-place">{caso.place}</span>
        </div>
        <button type="button" className="zv-replay" data-replay aria-label="Ver la conversación de nuevo" title="Ver de nuevo">
          <span aria-hidden="true">↻</span>
        </button>
      </div>
      <p className="zv-ft-status" data-status>
        <i aria-hidden="true" />
        <span data-status-text>Agente IA · en línea</span>
      </p>
      <div className="zv-chat zv-chat--caso" data-chat>
        <div className="zv-chat-track" data-track>
          {caso.messages.map((m, i) => (
            <div key={i} className="zv-msg" data-who={m.who} data-msg={i}>
              {m.who === 'agent' && (
                <span className="zv-typing" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              )}
              <div className="zv-msg-in">
                <div className="zv-bubble">{m.text}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function CasoSteps({ caso }: { caso: Pick<Caso, 'name' | 'steps' | 'marks' | 'done'> }) {
  return (
    <div className="zv-ft-side" data-reveal-item>
      <p className="zv-ft-kick">Qué hizo el agente</p>
      <ol className="zv-ft-steps" data-steps>
        {caso.steps.map((s, i) => (
          <li key={i} data-at={caso.marks[i]}>
            <span className="zv-list-n">{pad(i + 1)}</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      <p className="zv-caso-done" data-done>
        <span className="zv-caso-check" aria-hidden="true">
          ✓
        </span>
        {caso.done}
      </p>
      <p className="zv-ft-note">Conversación de demostración · negocio ficticio «{caso.name}».</p>
    </div>
  )
}
