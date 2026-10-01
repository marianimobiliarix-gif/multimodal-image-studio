
export interface Base64Image {
  data: string;
  mimeType: string;
}

export interface GenerationResult {
  url: string | null;
  error: string | null;
  id: string;
}

export interface AppState {
  files: File[];
  base64Images: Base64Image[];
  prompt: string;
  generatedImages: GenerationResult[];
  isLoading: boolean;
  error: string | null;
  successMessage: string | null;
  selectedPhotoStyle: string;
  selectedFashionStyle: string;
}
