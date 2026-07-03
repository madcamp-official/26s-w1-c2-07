import { NextResponse } from "next/server";

export function apiData<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export function apiError(message: string, status = 400) {
  return NextResponse.json(
    {
      error: {
        message,
        status,
      },
    },
    { status },
  );
}

