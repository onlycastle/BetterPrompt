import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      error: 'Gone',
      message: 'Hosted maintenance endpoints are not used in self-hosted mode.',
    },
    { status: 410 }
  );
}
