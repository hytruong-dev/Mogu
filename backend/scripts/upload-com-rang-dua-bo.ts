import { uploadAndSetDishImage } from './upload-dish-image';

async function main() {
  const dishId = '8f4ddf33-c13d-41c4-acf2-29b043f7301e';
  const imagePath = 'C:\\Users\\PC\\.gemini\\antigravity\\brain\\084088a0-83ad-45b9-b28c-a996f3c6d547\\com_rang_dua_bo_1792722426920.jpg';
  const dishName = 'Cơm rang dưa bò';

  console.log(`Bắt đầu tải ảnh cho "${dishName}"...`);
  const result = await uploadAndSetDishImage(dishId, imagePath, dishName);
  console.log('Hoàn thành:', result);
}

main().catch(console.error);
