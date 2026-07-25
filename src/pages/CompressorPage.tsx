import { ImageDown } from "lucide-react";
import { useCallback, useState } from "react";
import { BatchResults } from "../components/BatchResults";
import { ExportControls } from "../components/ExportControls";
import { FileDropzone } from "../components/FileDropzone";
import { ToolLayout } from "../components/ToolLayout";
import { useBatchProcessing } from "../hooks/useBatchProcessing";
import { useLanguage } from "../i18n/LanguageContext";
import type { ExportOptions } from "../types/media";
import { compressImage, isSupportedImage } from "../utils/imageProcessing";

export function CompressorPage() {
  const { language, t } = useLanguage();
  const [options, setOptions] = useState<ExportOptions>({
    format: "image/webp", quality: 80, backgroundColor: "#ffffff",
  });
  const processor = useCallback(async (file: File) => {
    if (!isSupportedImage(file)) throw new Error("JPG, PNG, and WEBP only");
    try {
      return await compressImage(file, options);
    } catch (error) {
      if (error instanceof Error && error.message === "NO_SMALLER_OUTPUT") {
        throw new Error(language === "zh"
          ? "在质量不低于 40 的条件下，所选格式无法生成更小的文件。请降低质量或保持原格式。"
          : "The selected format cannot produce a smaller file above quality 40. Lower quality or keep the original format.");
      }
      throw error;
    }
  }, [language, options]);
  const batch = useBatchProcessing(processor);

  return (
    <ToolLayout
      icon={ImageDown}
      title={t("compressor")}
      description={t("compressorDesc")}
      controls={<ExportControls value={options} onChange={setOptions} />}
    >
      <FileDropzone accept="image/jpeg,image/png,image/webp" detail={language === "zh" ? "JPG、PNG、WEBP · 支持批量压缩" : "JPG, PNG, WEBP · batch compression"} onFiles={(files) => void batch.processFiles(files)} />
      <BatchResults jobs={batch.jobs} zipName="imgskills-compressed.zip" onCancel={batch.cancel} />
    </ToolLayout>
  );
}
