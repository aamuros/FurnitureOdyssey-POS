import { NextResponse, type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { timeQuery } from "@/lib/query-timing";

export const runtime = "nodejs";

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: NextRequest, { params }: RouteParams) {
  await requirePermission("PRODUCTS", "VIEW");

  const { id } = await params;
  const images = await timeQuery("products:images", prisma.productImage.findMany({
    where: {
      productId: id
    },
    orderBy: [
      {
        isPrimary: "desc"
      },
      {
        sortOrder: "asc"
      },
      {
        createdAt: "asc"
      }
    ],
    select: {
      id: true,
      cloudinaryPublicId: true,
      secureUrl: true,
      altText: true,
      sortOrder: true,
      isPrimary: true
    }
  }));

  return NextResponse.json(
    {
      images: images.map((image) => ({
        ...image,
        altText: image.altText ?? ""
      }))
    },
    {
      headers: {
        "Cache-Control": "private, no-store"
      }
    }
  );
}
