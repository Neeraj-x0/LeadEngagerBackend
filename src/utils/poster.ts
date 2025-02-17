import { createCanvas, loadImage, Canvas, CanvasRenderingContext2D } from 'canvas';
import { AppError } from './errorHandler';
import sharp from 'sharp';

interface TextStyle {
  fontFamily?: string;    // e.g., "Arial"
  color?: string;         // e.g., "#000"
}

interface PosterOptions {
  logoBuffer: Buffer;
  companyName: string;
  name: string;
  title: string;
  note: string;
  iconBuffer: Buffer;
  backgroundBuffer?: Buffer;
  // Optional external styles for texts (only font family and color, not size or weight)
  companyNameStyle?: TextStyle;
  greetingStyle?: TextStyle;
  titleStyle?: TextStyle;
  noteStyle?: TextStyle;
}

class PosterGenerator {
  private canvas: Canvas;
  private ctx: CanvasRenderingContext2D;

  constructor(width: number = 800, height: number = 800) {
    this.canvas = createCanvas(width, height);
    this.ctx = this.canvas.getContext('2d');
  }

  private wrapText(text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const width = this.ctx.measureText(currentLine + " " + word).width;
      if (width < maxWidth) {
        currentLine += " " + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    lines.push(currentLine);
    return lines;
  }

  private async drawBackground(backgroundBuffer?: Buffer): Promise<void> {
    if (backgroundBuffer) {
      // Load and draw background image
      const background = await loadImage(backgroundBuffer);
      this.ctx.drawImage(background, 0, 0, this.canvas.width, this.canvas.height);
    } else {
      // Setting white background
      this.ctx.fillStyle = 'white';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      // Optional: Drawing grid lines for development
      if (process.env.NODE_ENV === 'development') {
        this.ctx.strokeStyle = '#f0f0f0';
        this.ctx.lineWidth = 1;
        for (let i = 0; i < this.canvas.width; i += 50) {
          this.ctx.beginPath();
          this.ctx.moveTo(i, 0);
          this.ctx.lineTo(i, this.canvas.height);
          this.ctx.stroke();
        }
        for (let i = 0; i < this.canvas.height; i += 50) {
          this.ctx.beginPath();
          this.ctx.moveTo(0, i);
          this.ctx.lineTo(this.canvas.width, i);
          this.ctx.stroke();
        }
      }
    }
  }

  private async convertToPng(imageBuffer: Buffer): Promise<Buffer> {
    return await sharp(imageBuffer)
      .png()
      .toBuffer();
  }

  async generate(options: PosterOptions): Promise<Buffer> {
    if (options.note.length > 255) {
      throw new AppError('Note must be 255 characters or less', 400);
    }
    if (options.title.length > 75) {
      throw new AppError('Title must be 75 characters or less', 400);
    }

    // Convert icon to PNG
    options.iconBuffer = await this.convertToPng(options.iconBuffer);

    // Convert logo to PNG
    options.logoBuffer = await this.convertToPng(options.logoBuffer);

    // Convert background to PNG if provided
    if (options.backgroundBuffer) {
      options.backgroundBuffer = await this.convertToPng(options.backgroundBuffer);
    }

    // Draw background
    await this.drawBackground(options.backgroundBuffer);

    // Load and draw logo
    const logo = await loadImage(options.logoBuffer);
    this.ctx.drawImage(logo, 50, 50, 50, 50);

    // Draw company name using external style if provided, else default style.
    // Default: 24px normal, default font = Arial, color = black
    const companyFontFamily = options.companyNameStyle?.fontFamily || 'Arial';
    const companyColor = options.companyNameStyle?.color || '#000';
    this.ctx.font = `24px ${companyFontFamily}`;
    this.ctx.fillStyle = companyColor;
    this.ctx.fillText(options.companyName, 120, 80);

    // Draw greeting text ("Hey {name},") using external style if provided.
    // Default: bold 48px Arial, color = black
    const greetingFontFamily = options.greetingStyle?.fontFamily || 'Arial';
    const greetingColor = options.greetingStyle?.color || '#000';
    this.ctx.font = `bold 48px ${greetingFontFamily}`;
    this.ctx.fillStyle = greetingColor;
    this.ctx.fillText(`Hey ${options.name},`, 50, 250);

    // Draw title text using external style if provided.
    // Default: bold 32px Arial, color = black
    const titleFontFamily = options.titleStyle?.fontFamily || 'Arial';
    const titleColor = options.titleStyle?.color || '#000';
    this.ctx.font = `bold 32px ${titleFontFamily}`;
    this.ctx.fillStyle = titleColor;
    const titleLines = this.wrapText(options.title, 700);
    let y = 350;
    titleLines.forEach(line => {
      this.ctx.fillText(line, 50, y);
      y += 70;
    });

    // Draw note text using external style if provided.
    // Default: 24px Arial, color = black
    const noteFontFamily = options.noteStyle?.fontFamily || 'Arial';
    const noteColor = options.noteStyle?.color || '#000';
    this.ctx.font = `24px ${noteFontFamily}`;
    this.ctx.fillStyle = noteColor;
    const noteLines = this.wrapText(options.note, 600);
    y = 550; // Adjust y starting point for note section
    noteLines.forEach(line => {
      this.ctx.fillText(line, 50, y);
      y += 30;
    });

    // Load and draw the right side image (icon)
    const rightImage = await loadImage(options.iconBuffer);
    this.ctx.drawImage(rightImage, this.canvas.width - 250, 350, 200, 200);

    return this.canvas.toBuffer('image/png');
  }
}

export { PosterGenerator };