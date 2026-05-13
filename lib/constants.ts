// Categorias de serviço — 6 fixas do MVP (PRD seção 4)
export const SERVICE_CATEGORIES = [
  { slug: 'eletrica', label: 'Elétrica' },
  { slug: 'hidraulica', label: 'Hidráulica' },
  { slug: 'montagem', label: 'Montagem' },
  { slug: 'limpeza', label: 'Limpeza' },
  { slug: 'ar-condicionado', label: 'Ar-condicionado' },
  { slug: 'reparos', label: 'Pequenos reparos' },
] as const

// Bairros prioritários — Grande Vitória (PRD seção 16)
export const NEIGHBORHOODS = [
  // Vitória
  'Praia do Canto',
  'Jardim da Penha',
  'Jardim Camburi',
  'Mata da Praia',
  'Bento Ferreira',
  // Vila Velha
  'Praia da Costa',
  'Itapuã',
  'Itaparica',
  'Coqueiral',
  'Praia de Itaparica',
] as const
