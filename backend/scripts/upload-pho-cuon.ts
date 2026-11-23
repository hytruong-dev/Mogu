import { uploadAndSetDishImage } from './upload-dish-image';

async function main() {
  const dishId = 'c9ec83ca-ee05-4f9f-8185-3616f5f3ba23';
  const imagePath = 'C:\\Users\\PC\\.gemini\\antigravity\\brain\\084088a0-83ad-45b9-b28c-a996f3c6d547\\pho_cuon_ha_noi_1792722459043.jpg';
  const dishName = 'Phở cuốn Hà Nội';

  console.log(`Bắt đầu tải ảnh cho "${dishName}"...`);
  const result = await uploadAndSetDishImage(dishId, imagePath, dishName);
  console.log('Hoàn thành:', result);
}

main().catch(console.error);
