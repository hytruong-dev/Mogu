import * as fs from 'fs';
import * as path from 'path';
import { uploadAndSetStepImage } from './upload-step-image';

interface StepPrompt {
  dishName: string;
  dishId: string;
  stepId: string;
  stepOrder: number;
  imageName: string;
  prompt: string;
}

const ARTIFACT_DIR = 'C:\\Users\\PC\\.gemini\\antigravity\\brain\\084088a0-83ad-45b9-b28c-a996f3c6d547';
const PROMPTS_FILE = path.join(__dirname, 'target-14-step-prompts.json');

async function main() {
  const steps: StepPrompt[] = JSON.parse(fs.readFileSync(PROMPTS_FILE, 'utf-8'));
  const allFiles = fs.readdirSync(ARTIFACT_DIR);

  console.log(`=== SYNC STEP IMAGES TO SUPABASE STORAGE ===`);
  console.log(`Total target steps: ${steps.length}`);

  let synced = 0;
  let missing = 0;

  for (const step of steps) {
    // Find matching file in artifact directory: ${step.imageName}_*.jpg
    const matchedFile = allFiles
      .filter(f => f.startsWith(step.imageName) && (f.endsWith('.jpg') || f.endsWith('.png')))
      .sort()
      .pop(); // take latest if multiple

    if (matchedFile) {
      const fullPath = path.join(ARTIFACT_DIR, matchedFile);
      try {
        console.log(`Processing [${step.dishName}] Step ${step.stepOrder} with ${matchedFile}...`);
        const publicUrl = await uploadAndSetStepImage(
          step.stepId,
          step.dishId,
          step.stepOrder,
          fullPath,
        );
        console.log(`✅ Success: ${publicUrl}`);
        synced++;
      } catch (err: any) {
        console.error(`❌ Failed to upload step ${step.stepId}:`, err.message);
      }
    } else {
      console.log(`⏳ Missing generated file for [${step.dishName}] Step ${step.stepOrder} (${step.imageName})`);
      missing++;
    }
  }

  console.log(`\nTổng kết: Đã đồng bộ ${synced} bước, Còn thiếu ${missing} bước.`);
}

main().catch(console.error);
