import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('customFood count:', await prisma.customFood.count());
  console.log('placeDish count:', await prisma.placeDish.count());
  console.log('recipeStep missing image:', await prisma.recipeStep.count({ where: { imageUrl: null } }));
  console.log('recipeStep total:', await prisma.recipeStep.count());
  console.log('ingredient missing image:', await prisma.ingredient.count({ where: { imageUrl: null, isActive: true } }));
  console.log('ingredient total active:', await prisma.ingredient.count({ where: { isActive: true } }));
  console.log('dish total active:', await prisma.dish.count({ where: { deletedAt: null } }));
  console.log('dish total all (including soft-deleted):', await prisma.dish.count());
}

main().finally(async () => {
  await prisma.$disconnect();
  await pool.end();
  process.exit(0);
});
