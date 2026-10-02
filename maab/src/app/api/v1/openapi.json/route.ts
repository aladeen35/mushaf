import { openApi } from '@/server/api/contract';

export function GET() {
  return Response.json(openApi());
}
