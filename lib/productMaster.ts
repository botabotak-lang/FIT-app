export type Product = {
  name: string;
  modelType: string;
  supplier: string;
  purchasePrice: number;
  sellingPrice: number;
};

export const PRODUCT_MASTER: Product[] = [
  {
    name: "船舶用VHF無線機",
    modelType: "JHS-800",
    supplier: "JRC",
    purchasePrice: 45000,
    sellingPrice: 68000,
  },
  {
    name: "GPSアンテナ",
    modelType: "GPS-20A",
    supplier: "JRC",
    purchasePrice: 12000,
    sellingPrice: 18000,
  },
  {
    name: "レーダースキャナー",
    modelType: "JMA-1032",
    supplier: "JRC",
    purchasePrice: 85000,
    sellingPrice: 128000,
  },
  {
    name: "航海灯（LED）",
    modelType: "NL-50",
    supplier: "モノタロウ",
    purchasePrice: 4500,
    sellingPrice: 7200,
  },
  {
    name: "船舶用バッテリー",
    modelType: "SMF-105D31R",
    supplier: "アマゾン",
    purchasePrice: 15000,
    sellingPrice: 24000,
  },
  {
    name: "同軸ケーブル（5D-2V）10m",
    modelType: "5D-2V-10",
    supplier: "モノタロウ",
    purchasePrice: 2800,
    sellingPrice: 4500,
  },
  {
    name: "BNCコネクタ",
    modelType: "BNC-5D",
    supplier: "モノタロウ",
    purchasePrice: 350,
    sellingPrice: 600,
  },
  {
    name: "ヒューズ 30A",
    modelType: "FH-30A",
    supplier: "モノタロウ",
    purchasePrice: 180,
    sellingPrice: 350,
  },
  {
    name: "配電盤スイッチ",
    modelType: "SW-200V-30A",
    supplier: "ハードストック",
    purchasePrice: 3200,
    sellingPrice: 5500,
  },
  {
    name: "AISトランスポンダー",
    modelType: "JHS-183",
    supplier: "JRC",
    purchasePrice: 120000,
    sellingPrice: 185000,
  },
];
