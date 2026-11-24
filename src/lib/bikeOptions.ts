export const BLOCK_OPTIONS = ['Bloco A', 'Bloco B'];

export const OTHER_MODEL = 'Outro modelo';
export const OTHER_BRAND = 'Outra marca';

export const BRAND_MODELS: Record<string, string[]> = {
  'Atrio (Multilaser)': ['Berlin', 'Miami', 'Seoul'],
  Bee: ['Bee Cargo / Family', 'Bee Dobrável', 'Bee S1', 'Bee S2', 'Bee Urban / City'],
  'Bemm (E-Moving)': ['Bemm City', 'Bemm Dobrável', 'Bemm Fat / Cargo', 'Bemm Sport'],
  Bikelete: ['Smart MT2', 'Smart MT5', 'StreetGo S12'],
  Caloi: ['E-Vibe City', 'E-Vibe Easy Rider', 'E-Vibe Urbam', 'Mobylette Elétrica'],
  Cavalletta: ['C2', 'C3'],
  'Duos Bikes': ['Confort', 'Eko', 'Fox', 'Touring'],
  Honeywhale: ['B20', 'F6 Pro', 'S6-S'],
  Inow: ['V9 Max', 'V40 Pro'],
  Lev: ['Cruiser', 'E-Bike L', 'E-Bike S'],
  Moura: ['Ella'],
  Nado: ['C2', 'S73'],
  Oggi: ['Big Wheel 8.0', 'Big Wheel 8.3', 'Lite Tour'],
  Oimotoo: ['A9', 'S6'],
  Onn: ['N1', 'N1 Lite'],
  Panda: ['S73'],
  Sense: ['Breeze', 'Easy', 'Impulse'],
  Specialized: ['Turbo Como', 'Turbo Levo', 'Turbo Vado'],
  'Tailg / Sousa': ['Dyno', 'Eco 350'],
  'Two Dogs': ['Fat', 'Pliage (Dobrável)'],
  Urbikes: ['V9 Max'],
  Xroymexroy: ['EB3', 'EB5 Max', 'Y16'],
  'Yoo Mobility': ['Y-200'],
};

export const BRAND_OPTIONS = [...Object.keys(BRAND_MODELS), OTHER_BRAND];

export const OTHER_COLOR = 'Outra cor';
export const COLOR_OPTIONS = ['Preta', 'Branca', 'Prata', 'Vermelha', 'Azul', 'Verde', 'Amarela', 'Cinza', OTHER_COLOR];

export const DEACTIVATION_REASONS = ['Mudança de endereço', 'Roubo/Furto', 'Perda', 'Venda da bicicleta', 'Outro'];
