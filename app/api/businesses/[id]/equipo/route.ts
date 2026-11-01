import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireBusinessAccess } from '@/lib/authz'
import { addProfessional, getBusiness, listProfessionals } from '@/lib/store'

const MAX_TEAM = 30

const schema = z.object({ name: z.string().trim().min(1).max(60) })

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireBusinessAccess(id)
  if (user instanceof NextResponse) return user

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Escribe el nombre de la persona.' }, { status: 400 })

  if (!(await getBusiness(id))) {
    return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
  }

  const team = await listProfessionals(id)
  if (team.length >= MAX_TEAM) {
    return NextResponse.json({ error: `El equipo puede tener hasta ${MAX_TEAM} personas.` }, { status: 400 })
  }
  if (team.some((p) => p.name.toLowerCase() === parsed.data.name.toLowerCase())) {
    return NextResponse.json({ error: 'Ya hay alguien con ese nombre.' }, { status: 400 })
  }

  const professional = await addProfessional(id, parsed.data.name)
  return NextResponse.json({ professional }, { status: 201 })
}
