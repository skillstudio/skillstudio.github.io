import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, ArrowLeft, ArrowRight, Box, Check, Download,
  FolderPlus, ImagePlus, Layers3, Loader2, PackageCheck, Palette, Play, Upload,
  RotateCcw, ShieldCheck, Star, Trash2, X,
} from "lucide-react";
import { commercePresets, defaultCommercePresetIds } from "../data/commercePresets";
import { useLanguage } from "../i18n/LanguageContext";
import type {
  BrandKit, CommerceAsset, CommerceCompressionSettings, CommerceProgress, DeliverySummary,
  LogoPosition, MarketplaceId, ProductGroup, ProductPhoto, SubjectExtractionMode,
} from "../types/commerce";
import {
  analyzePhoto, packageCommerceProject, processCommerceProject, safeName, suggestedGroupName,
} from "../utils/commerce";
import { downloadBlob } from "../utils/download";
import { createJobId, formatBytes, isSupportedImage } from "../utils/imageProcessing";

const defaultBrand: BrandKit = {
  primaryColor: "#0891b2",
  secondaryColor: "#312e81",
  shadowStrength: 42,
  watermark: "",
  badge: "",
  logoWatermark: { enabled: false, position: "bottom-right", opacity: 80, scale: 12, margin: 4 },
};

const defaultCompression: CommerceCompressionSettings = {
  enabled: true, profile: "balanced", quality: 82,
};
const settingsRevision = 2;
const defaultSubjectMode: SubjectExtractionMode = "precise";

type Step = 1 | 2 | 3 | 4 | 5;

function readSavedSettings(): { presetIds: string[]; brandKit: BrandKit; compression: CommerceCompressionSettings; subjectMode: SubjectExtractionMode } {
  try {
    const value = JSON.parse(localStorage.getItem("imgskills-commerce-v2-settings") || "");
    if (Array.isArray(value.presetIds) && value.brandKit) {
      const useUpdatedDefaults = value.settingsRevision !== settingsRevision;
      return {
        presetIds: useUpdatedDefaults ? defaultCommercePresetIds : value.presetIds,
        brandKit: { ...defaultBrand, ...value.brandKit, logoWatermark: { ...defaultBrand.logoWatermark, ...value.brandKit.logoWatermark, enabled: false } },
        compression: { ...defaultCompression, ...value.compression },
        subjectMode: useUpdatedDefaults
          ? defaultSubjectMode
          : value.subjectMode === "original" || value.subjectMode === "precise" ? value.subjectMode : "standard",
      };
    }
  } catch { /* use defaults */ }
  return { presetIds: defaultCommercePresetIds, brandKit: defaultBrand, compression: defaultCompression, subjectMode: defaultSubjectMode };
}

export function CommerceStudioPage() {
  const { language } = useLanguage();
  const zh = language === "zh";
  const saved = useMemo(readSavedSettings, []);
  const [step, setStep] = useState<Step>(1);
  const [projectName, setProjectName] = useState(zh ? "商品图片项目" : "Product image project");
  const [photos, setPhotos] = useState<ProductPhoto[]>([]);
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [presetIds, setPresetIds] = useState<string[]>(saved.presetIds);
  const [brandKit, setBrandKit] = useState<BrandKit>(saved.brandKit);
  const [compression, setCompression] = useState<CommerceCompressionSettings>(saved.compression);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState("");
  const [subjectMode, setSubjectMode] = useState<SubjectExtractionMode>(saved.subjectMode);
  const [progress, setProgress] = useState<CommerceProgress>({ stage: "idle", current: 0, total: 1, message: "" });
  const [assets, setAssets] = useState<CommerceAsset[]>([]);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const assigned = useMemo(() => new Set(groups.flatMap((group) => group.photoIds)), [groups]);
  const unassignedPhotos = photos.filter((photo) => !assigned.has(photo.id));
  const selectedPresets = commercePresets.filter((preset) => presetIds.includes(preset.id));
  const presetSections = [
    { title: zh ? "通用交付规格" : "Universal deliverables", ids: ["universal"] },
    { title: zh ? "中国大陆电商平台" : "Mainland China marketplaces", ids: ["taobao", "jd", "pdd", "douyin"] },
    { title: zh ? "跨境电商平台" : "Cross-border marketplaces", ids: ["amazon", "walmart", "ebay", "etsy", "shopify", "aliexpress", "temu", "shein", "shopee", "lazada", "tiktok-shop", "mercado-libre"] },
  ];
  const groupedPhotoCount = photos.length - unassignedPhotos.length;
  const warningCount = assets.filter((asset) => asset.warnings.length > 0).length;
  const deliverySummary: DeliverySummary = {
    productCount: groups.length,
    photoCount: photos.length,
    platformCount: new Set(selectedPresets.map((preset) => preset.marketplace)).size,
    outputCount: assets.length || groupedPhotoCount * selectedPresets.length,
    reviewCount: warningCount,
    outputBytes: assets.reduce((sum, asset) => sum + asset.blob.size, 0),
  };

  useEffect(() => () => {
    photos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    assets.forEach((asset) => URL.revokeObjectURL(asset.previewUrl));
    abortRef.current?.abort();
  }, []);

  useEffect(() => {
    const persistedBrand = { ...brandKit, logoWatermark: { ...brandKit.logoWatermark, enabled: false } };
    localStorage.setItem("imgskills-commerce-v2-settings", JSON.stringify({ settingsRevision, presetIds, brandKit: persistedBrand, compression, subjectMode }));
  }, [presetIds, brandKit, compression, subjectMode]);

  useEffect(() => {
    if (!logoFile) {
      setLogoUrl("");
      return;
    }
    const url = URL.createObjectURL(logoFile);
    setLogoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  async function addFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter(isSupportedImage);
    const incoming = files.map<ProductPhoto>((file) => ({
      id: createJobId(file), file, previewUrl: URL.createObjectURL(file),
    }));
    setPhotos((value) => [...value, ...incoming]);
    const analyzed = await Promise.all(incoming.map(async (photo) => ({
      id: photo.id, quality: await analyzePhoto(photo).catch(() => undefined),
    })));
    setPhotos((value) => value.map((photo) => {
      const report = analyzed.find((item) => item.id === photo.id);
      return report?.quality ? { ...photo, quality: report.quality } : photo;
    }));
  }

  function createGroup() {
    const chosen = selectedPhotoIds.length ? selectedPhotoIds : unassignedPhotos.slice(0, 1).map((photo) => photo.id);
    const first = photos.find((photo) => photo.id === chosen[0]);
    const index = groups.length + 1;
    setGroups((value) => [...value, {
      id: crypto.randomUUID(), name: first ? suggestedGroupName(first.file.name) : `SKU-${index}`,
      photoIds: chosen, primaryPhotoId: chosen[0],
    }]);
    setSelectedPhotoIds([]);
  }

  function assignSelected(groupId: string) {
    if (!selectedPhotoIds.length) return;
    setGroups((value) => value.map((group) => group.id === groupId
      ? { ...group, photoIds: [...new Set([...group.photoIds, ...selectedPhotoIds])], primaryPhotoId: group.primaryPhotoId || selectedPhotoIds[0] }
      : { ...group, photoIds: group.photoIds.filter((id) => !selectedPhotoIds.includes(id)) }));
    setSelectedPhotoIds([]);
  }

  function removePhoto(photoId: string) {
    const photo = photos.find((item) => item.id === photoId);
    if (photo) URL.revokeObjectURL(photo.previewUrl);
    setPhotos((value) => value.filter((item) => item.id !== photoId));
    setGroups((value) => value.map((group) => ({ ...group, photoIds: group.photoIds.filter((id) => id !== photoId) })));
    setSelectedPhotoIds((value) => value.filter((id) => id !== photoId));
  }

  function togglePreset(id: string) {
    setPresetIds((value) => value.includes(id) ? value.filter((item) => item !== id) : [...value, id]);
  }

  function togglePresetSection(marketplaces: string[]) {
    const ids = commercePresets.filter((preset) => marketplaces.includes(preset.marketplace)).map((preset) => preset.id);
    const allSelected = ids.every((id) => presetIds.includes(id));
    setPresetIds((value) => allSelected
      ? value.filter((id) => !ids.includes(id))
      : [...new Set([...value, ...ids])]);
  }

  function selectCompressionProfile(profile: CommerceCompressionSettings["profile"]) {
    const values = { high: 92, balanced: 82, light: 70, custom: compression.quality };
    setCompression({ enabled: true, profile, quality: values[profile] });
  }

  function handleLogoFile(file?: File) {
    setError("");
    if (!file) return;
    if (!["image/png", "image/webp"].includes(file.type)) {
      setError(zh ? "Logo 仅支持 PNG 或 WEBP 格式。" : "Logo must be a PNG or WEBP image.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError(zh ? "Logo 文件不能超过 10 MB。" : "Logo file must be 10 MB or smaller.");
      return;
    }
    setLogoFile(file);
  }

  function removeLogo() {
    setLogoFile(null);
    setBrandKit((value) => ({ ...value, logoWatermark: { ...value.logoWatermark, enabled: false } }));
  }

  async function runProject() {
    setError("");
    if (brandKit.logoWatermark.enabled && !logoFile) {
      setError(zh ? "请上传 Logo，或关闭 Logo 水印。" : "Upload a logo or turn off the logo watermark.");
      return;
    }
    assets.forEach((asset) => URL.revokeObjectURL(asset.previewUrl));
    setAssets([]);
    setStep(4);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const result = await processCommerceProject({
        name: projectName, photos, groups, presetIds, brandKit, compression, logoFile: logoFile || undefined, subjectMode,
      }, setProgress, controller.signal);
      setAssets(result);
      setStep(5);
    } catch (reason) {
      if ((reason as DOMException).name === "AbortError") {
        setProgress((value) => ({ ...value, stage: "cancelled" }));
      } else {
        setError(userFacingError(reason, zh));
        setProgress((value) => ({ ...value, stage: "error" }));
      }
    }
  }

  async function downloadProject() {
    setProgress({ stage: "packaging", current: 0, total: 1, message: zh ? "正在生成 ZIP" : "Creating ZIP" });
    const blob = await packageCommerceProject({ name: projectName, photos, groups, presetIds, brandKit, compression, logoFile: logoFile || undefined, subjectMode }, assets);
    downloadBlob(blob, `${safeName(projectName)}-commerce-pack.zip`);
    setProgress({ stage: "done", current: 1, total: 1, message: "" });
  }

  const steps = zh
    ? [["上传图片", "上传商品原图"], ["SKU 分组", "归类商品图片"], ["平台配置", "设置平台与品牌规范"], ["批量生成", "生成平台规格图片"], ["成果交付", "审核并下载成品"]]
    : [["Upload images", "Upload source images"], ["Group by SKU", "Classify product images"], ["Configure platforms", "Set platform and brand rules"], ["Batch generate", "Create platform-ready assets"], ["Deliver assets", "Review and download"]];

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-slate-950 text-white">
      <section className="border-b border-slate-800 bg-[radial-gradient(circle_at_60%_-20%,rgba(34,211,238,0.13),transparent_38%),#020617]">
        <div className="mx-auto max-w-[82rem] px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
            <div className="max-w-3xl">
              <h1 className="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
                {zh ? "多平台商品图片批量制作" : "Batch product image production for every marketplace"}
              </h1>
              <p className="mt-3 max-w-3xl text-[15px] leading-7 text-slate-400">
                {zh ? "批量上传商品原图，辅助完成背景优化、主体构图与常用平台规格适配，并生成结构化交付文件。" : "Upload source product images in batches, assist with background and framing adjustments, and generate structured deliverables using common marketplace specifications."}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-300">
                {(zh ? ["常用平台规格模板", "多 SKU 批量处理", "结构化 ZIP 交付"] : ["Common marketplace templates", "Multi-SKU batch processing", "Structured ZIP delivery"]).map((item) => <span key={item} className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5"><Check className="size-3.5 text-emerald-300" />{item}</span>)}
              </div>
            </div>
            <div className="flex max-w-md shrink-0 items-center gap-2 text-xs leading-5 text-emerald-200/80 lg:justify-end lg:pb-1 lg:text-right">
              <ShieldCheck className="size-4 shrink-0" />
              <span>{zh ? "浏览器端处理；部分能力首次使用需加载运行资源" : "Browser processing; some features load runtime resources on first use"}</span>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-[82rem] gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[12rem_minmax(0,1fr)_15rem] lg:gap-5 lg:px-8">
        <aside className="hidden h-fit rounded-2xl border border-slate-800 bg-slate-900/70 p-3 lg:sticky lg:top-24 lg:block">
          {steps.map(([title, body], index) => {
            const number = (index + 1) as Step;
            const active = number === step;
            const complete = number < step;
            return (
              <button key={title} type="button" disabled={number > step && number > 3} onClick={() => number < 4 && setStep(number)}
                className={`flex w-full gap-3 rounded-xl p-3 text-left transition ${active ? "bg-cyan-300 text-slate-950" : "text-slate-400 hover:bg-slate-800"} disabled:cursor-not-allowed disabled:opacity-50`}>
                <span className={`flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${active ? "bg-slate-950/10" : complete ? "bg-emerald-400/15 text-emerald-300" : "bg-slate-800"}`}>
                  {complete ? <Check className="size-3.5" /> : number}
                </span>
                <span><span className={`block text-sm font-semibold ${active ? "text-slate-950" : "text-slate-200"}`}>{title}</span><span className={`mt-0.5 block text-[11px] ${active ? "text-slate-700" : "text-slate-500"}`}>{body}</span></span>
              </button>
            );
          })}
        </aside>

        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-cyan-200">{zh ? `步骤 ${step}/5` : `Step ${step}/5`}</span>
            <strong className="text-sm text-white">{steps[step - 1][0]}</strong>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-cyan-300 transition-all" style={{ width: `${step * 20}%` }} /></div>
        </div>

        <main className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900/50 p-4 shadow-[0_24px_70px_rgba(2,6,23,0.16)] sm:p-6">
          {step === 1 && (
            <section>
              <PanelTitle icon={ImagePlus} title={zh ? "上传商品原图" : "Upload source product images"} body={zh ? "批量上传不同商品的原始图片，下一步按 SKU 完成归类。" : "Upload source images for multiple products, then classify them by SKU."} />
              <button type="button" onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void addFiles(event.dataTransfer.files); }}
                className="mt-5 flex min-h-48 w-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-600 bg-slate-950/60 px-6 text-center transition hover:border-cyan-400/60 hover:bg-cyan-400/[0.03]">
                <span className="flex size-12 items-center justify-center rounded-xl bg-cyan-300/10 text-cyan-200"><ImagePlus className="size-5" /></span>
                <strong className="mt-3 text-base">{zh ? "选择商品图片" : "Choose product images"}</strong>
                <span className="mt-1 text-xs text-slate-400">{zh ? "支持点击选择或拖拽上传" : "Choose files or drag them here"}</span>
                <span className="mt-2 text-xs font-medium tracking-wide text-slate-500">JPG · PNG · WEBP</span>
              </button>
              <input ref={inputRef} className="hidden" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => event.target.files && void addFiles(event.target.files)} />
              <PhotoGrid photos={photos} selected={selectedPhotoIds} onSelect={(id) => setSelectedPhotoIds((value) => value.includes(id) ? value.filter((item) => item !== id) : [...value, id])} onRemove={removePhoto} zh={zh} />
              <StepActions nextDisabled={!photos.length} nextLabel={!photos.length ? (zh ? "上传后继续" : "Continue after upload") : undefined} onNext={() => setStep(2)} zh={zh} />
            </section>
          )}

          {step === 2 && (
            <section>
              <PanelTitle icon={Layers3} title={zh ? "按 SKU 归类商品图片" : "Classify product images by SKU"} body={zh ? "选择待归类图片并创建 SKU，或将图片加入已有 SKU；每个 SKU 可指定一张平台主图。" : "Select unclassified images to create a SKU or add them to an existing SKU, then designate a primary image."} />
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-950/50 p-3">
                <span className="text-sm text-slate-300">{zh ? `已选择 ${selectedPhotoIds.length} 张图片` : `${selectedPhotoIds.length} images selected`}</span>
                <button type="button" onClick={createGroup} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-slate-950"><FolderPlus className="size-4" />{zh ? "创建 SKU" : "Create SKU"}</button>
              </div>
              <PhotoGrid photos={unassignedPhotos} selected={selectedPhotoIds} onSelect={(id) => setSelectedPhotoIds((value) => value.includes(id) ? value.filter((item) => item !== id) : [...value, id])} onRemove={removePhoto} zh={zh} compact />
              <div className="mt-6 grid gap-4 xl:grid-cols-2">
                {groups.map((group) => (
                  <div key={group.id} className="rounded-2xl border border-slate-700 bg-slate-950/55 p-4">
                    <div className="flex items-center gap-2">
                      <Box className="size-4 text-cyan-300" />
                      <input value={group.name} onChange={(event) => setGroups((value) => value.map((item) => item.id === group.id ? { ...item, name: event.target.value } : item))}
                        className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-semibold text-white hover:border-slate-700 focus:border-cyan-400 focus:outline-none" />
                      {selectedPhotoIds.length > 0 && <button type="button" onClick={() => assignSelected(group.id)} className="rounded-lg bg-cyan-300 px-2.5 py-1.5 text-[11px] font-bold text-slate-950">{zh ? "加入所选图片" : "Add selected images"}</button>}
                    </div>
                    <div className="mt-3 grid grid-cols-4 gap-2">
                      {group.photoIds.map((photoId) => {
                        const photo = photos.find((item) => item.id === photoId);
                        if (!photo) return null;
                        return <button key={photo.id} type="button" className={`group relative aspect-square overflow-hidden rounded-lg border ${group.primaryPhotoId === photo.id ? "border-amber-300 ring-2 ring-amber-300/20" : "border-slate-700"}`} onClick={() => setGroups((value) => value.map((item) => item.id === group.id ? { ...item, primaryPhotoId: photo.id } : item))}><img className="size-full object-cover" src={photo.previewUrl} alt="" /><Star className={`absolute right-1 top-1 size-4 ${group.primaryPhotoId === photo.id ? "fill-amber-300 text-amber-300" : "text-white drop-shadow"}`} /></button>;
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <StepActions back onBack={() => setStep(1)} nextDisabled={!groups.length || unassignedPhotos.length > 0} onNext={() => setStep(3)} zh={zh} />
            </section>
          )}

          {step === 3 && (
            <section>
              <PanelTitle icon={Palette} title={zh ? "配置平台与品牌参数" : "Configure marketplace and brand settings"} body={zh ? "选择目标平台与交付规格，系统将参考当前模板的尺寸和构图参数生成图片；发布前请复核平台最新规则。" : "Select target marketplaces and deliverable specifications. Images use the current template dimensions and framing; review each marketplace's latest rules before publishing."} />
              {presetSections.map((section) => (
                <div key={section.title} className="mt-6">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-semibold text-white">{section.title}</h3>
                    <span className="h-px flex-1 bg-slate-800" />
                    <button type="button" onClick={() => togglePresetSection(section.ids)} className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-[10px] font-semibold text-slate-400 hover:border-cyan-300/40 hover:text-cyan-200">
                      {commercePresets.filter((preset) => section.ids.includes(preset.marketplace)).every((preset) => presetIds.includes(preset.id)) ? (zh ? "取消全选" : "Clear") : (zh ? "全选" : "Select all")}
                    </button>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {commercePresets.filter((preset) => section.ids.includes(preset.marketplace)).map((preset) => {
                      const active = presetIds.includes(preset.id);
                      return <button key={preset.id} type="button" onClick={() => togglePreset(preset.id)} className={`rounded-xl border p-3 text-left transition ${active ? "border-cyan-300/50 bg-cyan-300/10" : "border-slate-700 bg-slate-950/40 hover:border-slate-600"}`}><span className="flex items-start justify-between gap-2"><strong className="text-sm text-slate-100">{preset.label[language]}</strong><span className={`flex size-5 items-center justify-center rounded-md ${active ? "bg-cyan-300 text-slate-950" : "border border-slate-600"}`}>{active && <Check className="size-3.5" />}</span></span><span className="mt-2 block text-xs text-slate-500">{preset.width} × {preset.height} · {preset.format.replace("image/", "").toUpperCase()}</span>{preset.allowOverlays === false && <span className="mt-2 inline-flex rounded-full bg-slate-800 px-2 py-1 text-[9px] font-semibold text-slate-400">{zh ? "当前模板不添加水印和促销角标" : "This template omits watermarks and badges"}</span>}</button>;
                    })}
                  </div>
                </div>
              ))}
              <div className="mt-7 grid gap-5 rounded-2xl border border-slate-700 bg-slate-950/45 p-4 sm:grid-cols-2">
                <ColorControl label={zh ? "品牌主色" : "Primary color"} value={brandKit.primaryColor} onChange={(value) => setBrandKit({ ...brandKit, primaryColor: value })} />
                <ColorControl label={zh ? "辅助色" : "Secondary color"} value={brandKit.secondaryColor} onChange={(value) => setBrandKit({ ...brandKit, secondaryColor: value })} />
                <TextControl label={zh ? "水印文字（可选）" : "Watermark (optional)"} value={brandKit.watermark} onChange={(value) => setBrandKit({ ...brandKit, watermark: value })} placeholder="ImgSkills" />
                <TextControl label={zh ? "促销角标（可选）" : "Promo badge (optional)"} value={brandKit.badge} onChange={(value) => setBrandKit({ ...brandKit, badge: value })} placeholder={zh ? "新品" : "NEW"} />
                <label className="sm:col-span-2"><span className="text-xs font-semibold text-slate-300">{zh ? "接触阴影" : "Contact shadow"} · {brandKit.shadowStrength}%</span><input className="mt-3 w-full accent-cyan-300" type="range" min="0" max="100" value={brandKit.shadowStrength} onChange={(event) => setBrandKit({ ...brandKit, shadowStrength: Number(event.target.value) })} /></label>
                <div className="sm:col-span-2">
                  <div><strong className="block text-sm text-slate-100">{zh ? "商品主体处理" : "Product subject processing"}</strong><span className="mt-1 block text-xs leading-5 text-slate-500">{zh ? "根据拍摄环境选择主体提取方式。" : "Choose the extraction method that matches the source image."}</span></div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    {([
                      ["original", zh ? "保留原背景" : "Keep original", zh ? "不执行主体提取" : "No subject extraction"],
                      ["standard", zh ? "标准去背景" : "Standard removal", zh ? "适合主体独立、背景简单的图片" : "For isolated products and simple backgrounds"],
                      ["precise", zh ? "精细商品提取" : "Refined product extraction", zh ? "用于减少手部、人物及环境内容残留" : "Designed to reduce residual hands, people, and surrounding context"],
                    ] as const).map(([mode, title, description]) => <button key={mode} type="button" onClick={() => setSubjectMode(mode)} className={`rounded-xl border p-3 text-left transition ${subjectMode === mode ? "border-cyan-300/50 bg-cyan-300/10" : "border-slate-700 bg-slate-900/60 hover:border-slate-600"}`}><span className="flex items-center justify-between gap-2"><strong className="text-xs text-slate-100">{title}</strong><span className={`flex size-4 items-center justify-center rounded-full border ${subjectMode === mode ? "border-cyan-300 bg-cyan-300" : "border-slate-600"}`}>{subjectMode === mode && <span className="size-1.5 rounded-full bg-slate-950" />}</span></span><span className="mt-1.5 block text-[10px] leading-4 text-slate-500">{description}</span></button>)}
                  </div>
                  {subjectMode === "precise" && <div className="mt-3 rounded-xl border border-amber-300/15 bg-amber-300/[0.05] p-3 text-[11px] leading-5 text-amber-100/80">{zh ? "精细模式结合前景分割与边缘清理，处理时间较长；复杂遮挡或低对比图片可能需要人工复核。" : "Refined mode combines foreground segmentation with edge cleanup and takes longer. Complex occlusions or low-contrast images may require manual review."}</div>}
                </div>
              </div>
              <div className="mt-5 grid gap-5 xl:grid-cols-2">
                <section className="rounded-2xl border border-slate-700 bg-slate-950/45 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div><h3 className="text-sm font-semibold text-white">{zh ? "输出压缩" : "Output compression"}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{zh ? "在不改变平台规格尺寸的前提下优化成品文件大小。" : "Optimize file size without changing platform dimensions."}</p></div>
                    <label className="flex shrink-0 items-center gap-2 whitespace-nowrap text-xs text-slate-300"><input type="checkbox" className="size-4 accent-cyan-300" checked={compression.enabled} onChange={(event) => setCompression({ ...compression, enabled: event.target.checked })} />{zh ? "启用" : "Enabled"}</label>
                  </div>
                  {compression.enabled && <div className="mt-4">
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        ["high", zh ? "高质量" : "High quality"],
                        ["balanced", zh ? "均衡" : "Balanced"],
                        ["light", zh ? "轻量" : "Lightweight"],
                        ["custom", zh ? "自定义" : "Custom"],
                      ] as const).map(([profile, label]) => <button key={profile} type="button" onClick={() => selectCompressionProfile(profile)} className={`min-h-10 rounded-xl border px-3 text-xs font-semibold ${compression.profile === profile ? "border-cyan-300/50 bg-cyan-300/10 text-cyan-100" : "border-slate-700 text-slate-400 hover:border-slate-600"}`}>{label}{profile !== "custom" && <span className="ml-1 text-slate-500">{profile === "high" ? "92" : profile === "balanced" ? "82" : "70"}</span>}</button>)}
                    </div>
                    {compression.profile === "custom" && <label className="mt-4 block"><span className="flex justify-between text-xs font-semibold text-slate-300"><span>{zh ? "输出质量" : "Output quality"}</span><span>{compression.quality}</span></span><input className="mt-3 w-full accent-cyan-300" type="range" min="40" max="100" value={compression.quality} onChange={(event) => setCompression({ ...compression, quality: Number(event.target.value) })} /></label>}
                    <p className="mt-3 text-[11px] leading-5 text-slate-500">{zh ? "JPEG 与 WEBP 使用所选质量；PNG 透明素材保持无损。" : "Selected quality applies to JPEG and WEBP. Transparent PNG assets remain lossless."}</p>
                  </div>}
                </section>

                <section className="rounded-2xl border border-slate-700 bg-slate-950/45 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div><h3 className="text-sm font-semibold text-white">{zh ? "Logo 水印" : "Logo watermark"}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{zh ? "可选配置，仅应用于允许品牌元素的成品。" : "Optional; applied only to deliverables that permit branding."}</p></div>
                    <label className="flex shrink-0 items-center gap-2 whitespace-nowrap text-xs text-slate-300"><input type="checkbox" className="size-4 accent-cyan-300" checked={brandKit.logoWatermark.enabled} onChange={(event) => setBrandKit({ ...brandKit, logoWatermark: { ...brandKit.logoWatermark, enabled: event.target.checked } })} />{zh ? "启用" : "Enabled"}</label>
                  </div>
                  {brandKit.logoWatermark.enabled && <div className="mt-4">
                    {logoUrl ? <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-[linear-gradient(45deg,#1e293b_25%,transparent_25%),linear-gradient(-45deg,#1e293b_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#1e293b_75%),linear-gradient(-45deg,transparent_75%,#1e293b_75%)] bg-[length:16px_16px] p-3"><img className="h-14 w-24 object-contain" src={logoUrl} alt={zh ? "Logo 预览" : "Logo preview"} /><div className="min-w-0 flex-1"><strong className="block truncate text-xs text-slate-200">{logoFile?.name}</strong><span className="mt-1 block text-[10px] text-slate-500">{logoFile && formatBytes(logoFile.size)}</span></div><button type="button" onClick={removeLogo} className="flex size-9 items-center justify-center rounded-lg bg-slate-950/70 text-slate-400 hover:text-rose-300" aria-label={zh ? "移除 Logo" : "Remove logo"}><Trash2 className="size-4" /></button></div> : <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-600 bg-slate-900/50 text-center hover:border-cyan-300/50"><Upload className="size-5 text-cyan-300" /><span className="mt-2 text-xs font-semibold text-slate-200">{zh ? "上传 Logo" : "Upload logo"}</span><span className="mt-1 text-[10px] text-slate-500">PNG · WEBP · ≤ 10 MB</span><input className="hidden" type="file" accept="image/png,image/webp" onChange={(event) => handleLogoFile(event.target.files?.[0])} /></label>}
                    <div className="mt-4 grid gap-4 sm:grid-cols-[8rem_1fr]">
                      <div><p className="text-xs font-semibold text-slate-300">{zh ? "水印位置" : "Position"}</p><div className="mt-2 grid grid-cols-2 gap-1.5">{(["top-left", "top-right", "bottom-left", "bottom-right"] as LogoPosition[]).map((position) => <button key={position} type="button" title={logoPositionLabel(position, zh)} aria-label={logoPositionLabel(position, zh)} onClick={() => setBrandKit({ ...brandKit, logoWatermark: { ...brandKit.logoWatermark, position } })} className={`relative h-10 rounded-lg border ${brandKit.logoWatermark.position === position ? "border-cyan-300 bg-cyan-300/10" : "border-slate-700 bg-slate-900"}`}><span className={`absolute size-2 rounded-sm bg-cyan-300 ${position === "top-left" ? "left-2 top-2" : position === "top-right" ? "right-2 top-2" : position === "bottom-left" ? "bottom-2 left-2" : "bottom-2 right-2"}`} /></button>)}</div></div>
                      <div className="space-y-3">
                        {([
                          [zh ? "大小" : "Size", "scale", 5, 30, "%"],
                          [zh ? "透明度" : "Opacity", "opacity", 10, 100, "%"],
                          [zh ? "边距" : "Margin", "margin", 1, 10, "%"],
                        ] as const).map(([label, key, min, max, unit]) => <label key={key} className="block"><span className="flex justify-between text-[11px] font-semibold text-slate-400"><span>{label}</span><span>{brandKit.logoWatermark[key]}{unit}</span></span><input className="mt-1.5 w-full accent-cyan-300" type="range" min={min} max={max} value={brandKit.logoWatermark[key]} onChange={(event) => setBrandKit({ ...brandKit, logoWatermark: { ...brandKit.logoWatermark, [key]: Number(event.target.value) } })} /></label>)}
                      </div>
                    </div>
                    <p className="mt-3 text-[11px] leading-5 text-slate-500">{zh ? "当前模板标记为不添加品牌元素的主图和透明素材不会应用 Logo；发布前请复核平台规则。" : "Templates marked to omit brand elements will not apply the logo to main images or transparent assets. Review marketplace rules before publishing."}</p>
                  </div>}
                </section>
              </div>
              {error && <div role="alert" className="mt-5 rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</div>}
              <StepActions back onBack={() => setStep(2)} nextLabel={zh ? "生成全部平台图片" : "Generate all platform images"} nextDisabled={!presetIds.length} onNext={() => void runProject()} zh={zh} />
            </section>
          )}

          {step === 4 && (
            <section className="flex min-h-[32rem] flex-col items-center justify-center text-center">
              <span className="relative flex size-20 items-center justify-center rounded-3xl bg-cyan-300/10 text-cyan-200"><Loader2 className="size-9 animate-spin" /><span className="absolute inset-0 animate-ping rounded-3xl border border-cyan-300/20" /></span>
              <h2 className="mt-7 text-2xl font-semibold">{zh ? "正在批量生成平台图片" : "Generating platform-ready images"}</h2>
              <p className="mt-2 text-sm text-slate-400">{stageLabel(progress.stage, zh)}</p>
              <div className="mt-7 h-2 w-full max-w-md overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-indigo-400 transition-all" style={{ width: `${Math.min(100, progress.total ? progress.current / progress.total * 100 : 0)}%` }} /></div>
              <p className="mt-3 text-xs tabular-nums text-slate-500">{Math.min(progress.current, progress.total)} / {progress.total}</p>
              {error && <div className="mt-5 max-w-md rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</div>}
              <button type="button" onClick={() => abortRef.current?.abort()} className="mt-7 inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-700 px-4 text-sm text-slate-300 hover:bg-slate-800"><X className="size-4" />{zh ? "取消处理" : "Cancel"}</button>
            </section>
          )}

          {step === 5 && (
            <section>
              <PanelTitle icon={PackageCheck} title={zh ? "商品图片已生成" : "Product image deliverables are ready"} body={zh ? "请按 SKU 与平台审核输出结果；存在质量提示的图片已单独标记。" : "Review generated assets by SKU and marketplace. Images requiring attention are clearly marked."} />
              <div className="mt-6 flex flex-wrap gap-3">
                <Stat value={groups.length} label={zh ? "SKU 数量" : "SKUs"} />
                <Stat value={assets.length} label={zh ? "成品文件" : "Deliverable files"} />
                <Stat value={warningCount} label={zh ? "待审核项" : "Items to review"} warning={warningCount > 0} />
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {assets.map((asset) => (
                  <article key={asset.id} className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-950/55">
                    <div className="relative aspect-square bg-[linear-gradient(45deg,#111827_25%,transparent_25%),linear-gradient(-45deg,#111827_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#111827_75%),linear-gradient(-45deg,transparent_75%,#111827_75%)] bg-[length:20px_20px]"><img className="size-full object-contain" src={asset.previewUrl} alt={asset.fileName} />{asset.warnings.length > 0 && <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-amber-300 px-2 py-1 text-[10px] font-bold text-slate-950"><AlertTriangle className="size-3" />{asset.warnings.length}</span>}</div>
                    <div className="p-3"><div className="flex items-center gap-3"><div className="min-w-0 flex-1"><strong className="block truncate text-xs text-slate-200">{asset.fileName}</strong><span className="mt-1 block text-[11px] text-slate-500">{platformName(asset.marketplace)} · {asset.width} × {asset.height}</span></div><button type="button" onClick={() => downloadBlob(asset.blob, asset.fileName)} className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 text-slate-300 hover:border-cyan-300/40 hover:text-cyan-200" aria-label={zh ? "下载" : "Download"}><Download className="size-4" /></button></div><div className="mt-2 flex flex-wrap gap-1.5 text-[9px] font-semibold"><span className="rounded-full bg-slate-800 px-2 py-1 text-slate-400">{asset.fileName.endsWith(".png") ? `${zh ? "输出" : "Output"} ${formatBytes(asset.blob.size)}` : `${zh ? "生成基准" : "Generated baseline"} ${formatBytes(asset.uncompressedSize)} → ${formatBytes(asset.blob.size)}`}</span><span className="rounded-full bg-slate-800 px-2 py-1 text-slate-400">{asset.outputQuality === 100 && asset.fileName.endsWith(".png") ? (zh ? "PNG 无损" : "Lossless PNG") : `${zh ? "质量" : "Quality"} ${asset.outputQuality}`}</span><span className={`rounded-full px-2 py-1 ${asset.logoStatus === "applied" ? "bg-cyan-300/10 text-cyan-200" : "bg-slate-800 text-slate-500"}`}>{logoStatusLabel(asset.logoStatus, zh)}</span></div></div>
                  </article>
                ))}
              </div>
              <div className="mt-7 flex flex-col gap-3 border-t border-slate-800 pt-6 sm:flex-row sm:justify-between">
                <button type="button" onClick={() => setStep(3)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 text-sm font-semibold text-slate-300 hover:bg-slate-800"><RotateCcw className="size-4" />{zh ? "调整配置并重新生成" : "Revise settings and regenerate"}</button>
                <button type="button" onClick={() => void downloadProject()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-6 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-950/30 hover:bg-cyan-200"><Download className="size-4" />{zh ? "下载完整交付包" : "Download complete delivery pack"}</button>
              </div>
            </section>
          )}
        </main>

        <aside className="h-fit rounded-2xl border border-slate-800 bg-slate-900/60 p-4 lg:sticky lg:top-24">
          <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">{zh ? "交付摘要" : "Delivery summary"}</h2></div>
          <label className="mt-4 block"><span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{zh ? "项目名称" : "Project name"}</span><input value={projectName} onChange={(event) => setProjectName(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400" /></label>
          {photos.length ? (
            <dl className="mt-5 space-y-3 text-sm"><SummaryRow label={zh ? "SKU 数量" : "SKUs"} value={String(deliverySummary.productCount)} /><SummaryRow label={zh ? "源图片" : "Source images"} value={String(deliverySummary.photoCount)} /><SummaryRow label={zh ? "目标平台" : "Target platforms"} value={String(deliverySummary.platformCount)} /><SummaryRow label={zh ? "预计成品" : "Expected deliverables"} value={String(deliverySummary.outputCount)} />{deliverySummary.outputBytes > 0 && <SummaryRow label={zh ? "成品大小" : "Output size"} value={formatBytes(deliverySummary.outputBytes)} />}</dl>
          ) : (
            <div className="mt-5 border-t border-slate-800 pt-4">
              <p className="text-xs font-semibold text-slate-200">{zh ? "预计交付内容" : "Expected deliverables"}</p>
              <ul className="mt-3 space-y-2 text-xs text-slate-400">{(zh ? ["平台主图", "透明背景素材", "品牌营销图", "详情图与缩略图", "完整 ZIP 包"] : ["Marketplace main images", "Transparent cutouts", "Branded marketing images", "Detail images & thumbnails", "Complete ZIP pack"]).map((item) => <li key={item} className="flex items-center gap-2"><Check className="size-3.5 text-emerald-300" />{item}</li>)}</ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function PanelTitle({ icon: Icon, title, body }: { icon: typeof ImagePlus; title: string; body: string }) {
  return <div className="flex items-start gap-4"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-cyan-300/10 text-cyan-200"><Icon className="size-5" /></span><div><h2 className="text-xl font-semibold tracking-tight">{title}</h2><p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-400">{body}</p></div></div>;
}

function PhotoGrid({ photos, selected, onSelect, onRemove, zh, compact = false }: { photos: ProductPhoto[]; selected: string[]; onSelect: (id: string) => void; onRemove: (id: string) => void; zh: boolean; compact?: boolean }) {
  if (!photos.length) return null;
  return <div className={`mt-5 grid gap-3 ${compact ? "grid-cols-3 sm:grid-cols-5" : "grid-cols-2 sm:grid-cols-3 xl:grid-cols-4"}`}>{photos.map((photo) => { const active = selected.includes(photo.id); return <article key={photo.id} className={`group relative overflow-hidden rounded-xl border bg-slate-950 ${active ? "border-cyan-300 ring-2 ring-cyan-300/20" : "border-slate-700"}`}><button type="button" onClick={() => onSelect(photo.id)} className="block w-full text-left"><div className="relative aspect-square"><img className="size-full object-cover" src={photo.previewUrl} alt={photo.file.name} /><span className={`absolute left-2 top-2 flex size-5 items-center justify-center rounded-md border ${active ? "border-cyan-300 bg-cyan-300 text-slate-950" : "border-white/30 bg-slate-950/60"}`}>{active && <Check className="size-3.5" />}</span>{photo.quality && photo.quality.warnings.length > 0 && <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-amber-300 px-2 py-1 text-[9px] font-bold text-slate-950"><AlertTriangle className="size-3" />{photo.quality.warnings.length}</span>}</div>{!compact && <div className="p-2.5"><strong className="block truncate text-xs text-slate-200">{photo.file.name}</strong><span className="mt-1 block text-[10px] text-slate-500">{photo.quality ? `${photo.quality.width} × ${photo.quality.height}` : (zh ? "分析中…" : "Analyzing…")}</span></div>}</button><button type="button" onClick={() => onRemove(photo.id)} className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-lg bg-slate-950/75 text-slate-400 opacity-0 backdrop-blur group-hover:opacity-100 hover:text-rose-300" aria-label={zh ? "移除" : "Remove"}><Trash2 className="size-3.5" /></button></article>; })}</div>;
}

function StepActions({ back, onBack, onNext, nextDisabled, nextLabel, zh }: { back?: boolean; onBack?: () => void; onNext: () => void; nextDisabled?: boolean; nextLabel?: string; zh: boolean }) {
  const generateAction = Boolean(nextLabel && (nextLabel.includes("生成") || nextLabel.includes("Generate")));
  return <div className="sticky bottom-3 z-20 mt-7 flex items-center justify-between rounded-2xl border border-slate-700/80 bg-slate-900/95 p-3 shadow-[0_18px_50px_rgba(2,6,23,0.6)] backdrop-blur lg:static lg:rounded-none lg:border-x-0 lg:border-b-0 lg:bg-transparent lg:px-0 lg:pb-0 lg:pt-5 lg:shadow-none">{back ? <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-700 px-4 text-sm font-semibold text-slate-300 hover:bg-slate-800"><ArrowLeft className="size-4" />{zh ? "上一步" : "Back"}</button> : <span />}<button type="button" disabled={nextDisabled} onClick={onNext} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">{nextLabel || (zh ? "继续" : "Continue")}{generateAction ? <Play className="size-4" /> : <ArrowRight className="size-4" />}</button></div>;
}

function ColorControl({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label><span className="text-xs font-semibold text-slate-300">{label}</span><span className="mt-2 flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 p-2"><input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="size-8 cursor-pointer rounded-lg border-0 bg-transparent" /><input value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm uppercase text-slate-200 outline-none" /></span></label>;
}

function TextControl({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label><span className="text-xs font-semibold text-slate-300">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-2 min-h-12 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400" /></label>;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between border-b border-slate-800 pb-3"><dt className="text-slate-500">{label}</dt><dd className="font-semibold text-slate-200">{value}</dd></div>;
}

function Stat({ value, label, warning }: { value: number; label: string; warning?: boolean }) {
  return <div className={`min-w-32 rounded-xl border px-4 py-3 ${warning ? "border-amber-300/20 bg-amber-300/[0.06]" : "border-slate-700 bg-slate-950/50"}`}><strong className={`text-xl ${warning ? "text-amber-200" : "text-white"}`}>{value}</strong><span className="ml-2 text-xs text-slate-500">{label}</span></div>;
}

function stageLabel(stage: CommerceProgress["stage"], zh: boolean): string {
  const labels = zh
    ? { "preparing-model": "识别商品主体", analyzing: "校验商品图片", segmenting: "识别商品主体", composing: "适配平台规格", exporting: "生成平台图片", packaging: "生成交付文件", idle: "准备生成", done: "生成完成", error: "生成失败", cancelled: "任务已取消" }
    : { "preparing-model": "Identifying product subjects", analyzing: "Validating source images", segmenting: "Identifying product subjects", composing: "Applying platform specifications", exporting: "Generating platform assets", packaging: "Building delivery files", idle: "Preparing generation", done: "Generation complete", error: "Generation failed", cancelled: "Task cancelled" };
  return labels[stage];
}

function platformName(platform: MarketplaceId | "source"): string {
  const names: Record<MarketplaceId | "source", string> = {
    universal: "Universal", taobao: "Taobao / Tmall", jd: "JD", pdd: "Pinduoduo",
    douyin: "Douyin", amazon: "Amazon", shopify: "Shopify", ebay: "eBay", etsy: "Etsy",
    walmart: "Walmart", aliexpress: "AliExpress", temu: "Temu", shein: "SHEIN",
    shopee: "Shopee", lazada: "Lazada", "tiktok-shop": "TikTok Shop",
    "mercado-libre": "Mercado Libre", source: "Source",
  };
  return names[platform];
}

function logoPositionLabel(position: LogoPosition, zh: boolean): string {
  const labels: Record<LogoPosition, [string, string]> = {
    "top-left": ["左上", "Top left"], "top-right": ["右上", "Top right"],
    "bottom-left": ["左下", "Bottom left"], "bottom-right": ["右下", "Bottom right"],
  };
  return labels[position][zh ? 0 : 1];
}

function logoStatusLabel(status: CommerceAsset["logoStatus"], zh: boolean): string {
  if (status === "applied") return zh ? "已应用 Logo" : "Logo applied";
  if (status === "excluded") return zh ? "当前模板未应用" : "Omitted by current template";
  return zh ? "未启用 Logo" : "Logo disabled";
}

function userFacingError(reason: unknown, zh: boolean): string {
  if (reason instanceof DOMException && reason.name === "QuotaExceededError") return zh ? "设备可用存储空间不足，请释放空间后重新生成交付文件。" : "Insufficient device storage. Free some space and generate the delivery files again.";
  return zh ? "部分图片未能生成，请检查源图片后重新处理。" : "Some assets could not be generated. Review the source images and try again.";
}
