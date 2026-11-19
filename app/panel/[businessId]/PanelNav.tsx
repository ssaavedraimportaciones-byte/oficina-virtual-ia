"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLockup } from "@/app/BrandMark";

export interface NavItem {
  href: string;
  label: string;
  hint: string;
  icon: string;
  /** Para los pasos de armar el agente: listo o pendiente. */
  done?: boolean;
}

export interface NavProps {
  businessName: string;
  logo: React.ReactNode;
  adminLink: boolean;
  /** Primeros pasos: cuántos lleva. null = ya terminó y no se muestra. */
  setup: { href: string; completed: number; required: number } | null;
  daily: NavItem[];
  agent: NavItem[];
}

function Item({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`group flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors ${
        active
          ? "bg-amber-500/15 ring-1 ring-amber-500/40"
          : "hover:bg-gray-800/70"
      }`}
    >
      <span className="mt-0.5 text-lg leading-none" aria-hidden="true">
        {item.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`flex items-center gap-2 text-[0.95rem] font-medium ${active ? "text-amber-300" : "text-gray-100"}`}
        >
          {item.label}
          {item.done !== undefined &&
            (item.done ? (
              <span
                className="rounded-full bg-emerald-500/15 px-1.5 text-xs text-emerald-400"
                title="Listo"
              >
                ✓
              </span>
            ) : (
              <span
                className="rounded-full bg-amber-500/15 px-1.5 text-[0.7rem] text-amber-400"
                title="Pendiente"
              >
                pendiente
              </span>
            ))}
        </span>
        <span className="mt-0.5 block text-xs leading-snug text-gray-500 group-hover:text-gray-400">
          {item.hint}
        </span>
      </span>
    </Link>
  );
}

/**
 * Menú del panel: separa lo del día a día (lo que el agente ya hizo) de armar
 * al agente (lo que el dueño le enseña), en vez de una lista plana de opciones.
 * En celular se abre como cajón desde la barra de arriba.
 */
export default function PanelNav({
  businessName,
  logo,
  adminLink,
  setup,
  daily,
  agent,
}: NavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  // El inicio del negocio (/panel/x) no debe quedar marcado en todas sus subpáginas.
  const isActive = (href: string) => {
    const depth = href.split("/").length;
    return depth <= 3
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);
  };
  const close = () => setOpen(false);

  const body = (
    <>
      <Link href="/" onClick={close} className="mb-6 block">
        <BrandLockup />
      </Link>
      <Link
        href="/panel"
        onClick={close}
        className="block text-xs text-gray-500 hover:text-gray-300"
      >
        ← Todos mis negocios
      </Link>
      <div className="mt-2 flex items-center gap-2">
        {logo}
        <span className="truncate text-base font-semibold text-white">
          {businessName}
        </span>
      </div>

      {adminLink && (
        <Link
          href="/admin"
          onClick={close}
          className="mt-4 block rounded-md border border-amber-500/60 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-300 hover:bg-amber-500/20"
        >
          Panel del dueño
        </Link>
      )}

      {setup && (
        <Link
          href={setup.href}
          onClick={close}
          className={`mt-5 block rounded-lg border p-3 ${
            isActive(setup.href)
              ? "border-amber-400 bg-amber-500/15"
              : "border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10"
          }`}
        >
          <span className="flex items-center justify-between text-sm font-semibold text-amber-300">
            🚀 Primeros pasos
            <span className="text-xs font-medium text-amber-400">
              {setup.completed} de {setup.required}
            </span>
          </span>
          <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-gray-800">
            <span
              className="block h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-400"
              style={{
                width: `${Math.round((setup.completed / setup.required) * 100)}%`,
              }}
            />
          </span>
          <span className="mt-2 block text-xs text-gray-400">
            Te guiamos para dejar tu agente listo.
          </span>
        </Link>
      )}

      {/* Mientras el agente no está listo, armarlo es lo primero; después manda el día a día. */}
      {setup ? (
        <>
          <p className="mb-1 mt-6 px-3 text-[0.7rem] font-semibold uppercase tracking-wider text-gray-500">
            Arma tu agente
          </p>
          <nav className="flex flex-col gap-0.5" aria-label="Arma tu agente">
            {agent.map((item) => (
              <Item
                key={item.href + item.label}
                item={item}
                active={isActive(item.href)}
                onNavigate={close}
              />
            ))}
          </nav>
          <p className="mb-1 mt-6 px-3 text-[0.7rem] font-semibold uppercase tracking-wider text-gray-500">
            Tu día a día
          </p>
          <nav className="flex flex-col gap-0.5" aria-label="Tu día a día">
            {daily.map((item) => (
              <Item
                key={item.href}
                item={item}
                active={isActive(item.href)}
                onNavigate={close}
              />
            ))}
          </nav>
        </>
      ) : (
        <>
          <p className="mb-1 mt-6 px-3 text-[0.7rem] font-semibold uppercase tracking-wider text-gray-500">
            Tu día a día
          </p>
          <nav className="flex flex-col gap-0.5" aria-label="Tu día a día">
            {daily.map((item) => (
              <Item
                key={item.href}
                item={item}
                active={isActive(item.href)}
                onNavigate={close}
              />
            ))}
          </nav>

          <p className="mb-1 mt-6 px-3 text-[0.7rem] font-semibold uppercase tracking-wider text-gray-500">
            Arma tu agente
          </p>
          <nav className="flex flex-col gap-0.5" aria-label="Arma tu agente">
            {agent.map((item) => (
              <Item
                key={item.href + item.label}
                item={item}
                active={isActive(item.href)}
                onNavigate={close}
              />
            ))}
          </nav>
        </>
      )}
    </>
  );

  return (
    <>
      {/* Celular: barra superior con el negocio y el botón del menú */}
      <div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-gray-800 bg-gray-950/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex min-w-0 items-center gap-2">
          {logo}
          <span className="truncate font-semibold text-white">
            {businessName}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="panel-menu"
          className="shrink-0 rounded-md border border-gray-700 px-3 py-1.5 text-sm text-gray-200"
        >
          {open ? "Cerrar" : "Menú"}
        </button>
      </div>
      {open && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menú del panel"
        >
          <button
            type="button"
            aria-label="Cerrar menú"
            className="absolute inset-0 bg-black/60"
            onClick={close}
          />
          <aside
            id="panel-menu"
            className="absolute inset-y-0 left-0 w-80 max-w-[85vw] overflow-y-auto bg-gray-950 p-5 shadow-2xl"
          >
            {body}
          </aside>
        </div>
      )}

      {/* Computador: columna fija */}
      <aside className="hidden w-72 shrink-0 border-r border-gray-800 bg-gray-900/40 p-5 md:block">
        {body}
      </aside>
    </>
  );
}
