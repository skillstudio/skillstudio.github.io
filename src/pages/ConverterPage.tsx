import { RefreshCcw } from "lucide-react";
import { useCallback, useState } from "react";
import { BatchResults } from "../components/BatchResults";
import { ExportControls } from "../components/ExportControls";
import { FileDropzone } from "../components/FileDropzone";
import { ToolLayout } from "../components/ToolLayout";
import { useBatchProcessing } from "../hooks/useBatchProcessing";
import { useLanguage } from "../i18n/LanguageContext";
import type { ExportOptions } from "../types/media";
import { decodeImage, isSupportedImage, renderImage } from "../utils/imageProcessing";

export function ConverterPage() {
  const { language, t } = useLanguage();
  const [options, setOptions] = useState<ExportOptions>({
    format: "image/webp", quality: 85, backgroundColor: "#ffffff",
  });
  const processor = useCallback(async (file: File) => {
    if (!isSupportedImage(file)) throw new Error("JPG, PNG, and WEBP only");
    const image = await decodeImage(file);
    const width = image.width;
    const height = image.height;
    image.close();
    return renderImage(file, width, height, options, "converted");
  }, [options]);
  const batch = useBatchProcessing(processor);

  return (
    <ToolLayout
      icon={RefreshCcw}
      title={t("converter")}
      description={t("converterDesc")}
      controls={<ExportControls value={options} onChange={setOptions} />}
    >
      <FileDropzone
        accept="image/jpeg,image/png,image/webp"
        detail={language === "zh" ? "JPG、PNG、WEBP · 支持多文件" : "JPG, PNG, WEBP · multiple files supported"}
        onFiles={(files) => void batch.processFiles(files)}
      />
      <BatchResults jobs={batch.jobs} zipName="imgskills-converted.zip" onCancel={batch.cancel} />
    </ToolLayout>
  );
}
