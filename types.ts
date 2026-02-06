
export enum PaperType {
  LINED = 'Lined Notebook Paper',
  GRID = 'Math Grid Paper',
  PLAIN = 'Clean White Paper',
  OLD = 'Vintage Parchment',
  LEGAL = 'Yellow Legal Pad'
}

export interface StyleAnalysis {
  isRecognizable: boolean;
  slant?: string;
  pressure?: string;
  spacing?: string;
  quirks?: string;
  description?: string;
  failureReason?: string;
}

export interface HandwritingState {
  isCalibrated: boolean;
  referenceImage: string | null;
  styleProfile: StyleAnalysis | null;
  status: 'idle' | 'analyzing' | 'generating' | 'error';
  generatedPages: string[];
  generationProgress: {
    current: number;
    total: number;
  };
}
