"use client";
import React, { useEffect, useState } from "react";
import { ExamplePlayer } from "@/components/example-player";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Play } from "lucide-react";
import { STYLE_CAPTION_PRESETS } from "@/components/editor/constant/caption";
import {
  Studio,
  getEffectOptions,
  getTransitionOptions,
  ProjectJSON,
} from "openvideo";
import { regenerateCaptionClips } from "@/lib/caption-utils";
import { useRef } from "react";
import {
  CustomAnimationForm,
  CustomCaptionForm,
  CustomShaderForm,
} from "@/components/gallery/custom-preset-forms";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { ANIMATION_PRESETS } from "@/constants/animations";

const GalleryPage = () => {
  const effects = getEffectOptions();
  const transitions = getTransitionOptions();
  const [project, setProject] = useState<ProjectJSON | undefined>();
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState("animations");
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const studioRef = useRef<Studio | null>(null);
  const { data: session } = authClient.useSession();
  const router = useRouter();

  const [myPresets, setMyPresets] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const fetchMyPresets = async () => {
    try {
      const response = await fetch("/api/custom-presets");
      if (response.ok) {
        const data = await response.json();
        setMyPresets(data);
      }
    } catch (error) {
      console.error("Error fetching my presets:", error);
    }
  };

  useEffect(() => {
    if (session) {
      fetchMyPresets();
    }
  }, [session]);

  const loadCategoryJson = async (category: string) => {
    setLoading(true);
    setSelectedPreset(null);
    try {
      const response = await fetch(`/json/${category}.json`);
      if (response.ok) {
        const data = await response.json();
        setProject(data);
      } else {
        console.warn(`No JSON found for category: ${category}`);
      }
    } catch (error) {
      console.error("Error loading category JSON:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategoryJson(activeCategory);
  }, [activeCategory]);

  const handlePresetSelect = (preset: any, category: string) => {
    if (!project) return;
    const value = preset.value || preset.key || preset.label;
    setSelectedPreset(value);

    const newProject = JSON.parse(JSON.stringify(project));

    if (category === "Animation") {
      const imageClip = newProject.clips.find((c: any) => c.type === "Image");
      if (imageClip) {
        imageClip.animations = [
          {
            type: preset.value,
            opts: {
              duration: 1000000,
              delay: 0,
              easing: "easeOutQuad",
              iterCount: 1,
            },
          },
        ];
      }
    } else if (category === "Effect") {
      const effectClip = newProject.clips.find((c: any) => c.type === "Effect");
      if (effectClip) {
        effectClip.effect = {
          ...effectClip.effect,
          key: preset.key,
          name: preset.label,
        };
      }
    } else if (category === "Transition") {
      const transitionClip = newProject.clips.find(
        (c: any) => c.type === "Transition",
      );
      if (transitionClip) {
        transitionClip.transitionEffect = {
          ...transitionClip.transitionEffect,
          key: preset.key,
          name: preset.label,
        };
      }
    } else if (category === "Caption") {
      const applyCaptions = async () => {
        if (studioRef.current) {
          const x = preset.boxShadow?.x ?? 4;
          const y = preset.boxShadow?.y ?? 0;

          const styleUpdate: any = {
            fill: preset.color,
            strokeWidth: preset.borderWidth,
            stroke: preset.borderColor,
            fontFamily: preset.fontFamily || "Bangers-Regular",
            fontUrl:
              preset.fontUrl ||
              "https://fonts.gstatic.com/s/bangers/v13/FeVQS0BTqb0h60ACL5la2bxii28.ttf",
            align: (preset.textAlign || "center") as any,
            caption: {
              colors: {
                appeared: preset.appearedColor,
                active: preset.activeColor,
                activeFill: preset.activeFillColor,
                background: preset.backgroundColor,
                keyword: preset.isKeywordColor ?? "transparent",
              },
              preserveKeywordColor: preset.preservedColorKeyWord ?? false,
            },
            animation: preset.animation || "undefined",
            textCase: preset.textTransform || "normal",
            dropShadow: {
              color: preset.boxShadow?.color ?? "transparent",
              alpha: 0.5,
              blur: preset.boxShadow?.blur ?? 4,
              distance: Math.sqrt(x * x + y * y) ?? 4,
              angle: Math.PI / 4,
            },
            wordAnimation: preset.wordAnimation,
          };

          const allCaptionClips = studioRef.current.clips.filter(
            (c) => c.type === "Caption",
          );

          const mode = preset.type === "word" ? "single" : "multiple";

          for (const clip of allCaptionClips) {
            await regenerateCaptionClips({
              studio: studioRef.current,
              captionClip: clip,
              mode,
              fontSize: (clip as any).originalOpts?.fontSize,
              fontFamily: styleUpdate.fontFamily,
              fontUrl: styleUpdate.fontUrl,
              styleUpdate: styleUpdate,
            });
          }

          setProject(studioRef.current.exportToJSON());
          setLoading(false);
        } else {
          // Fallback if studio is not ready (original logic)
          newProject.clips.forEach((clip: any) => {
            if (clip.type === "Caption") {
              const fontFamily = preset.fontFamily || "Bangers-Regular";
              const fontUrl =
                preset.fontUrl ||
                "https://fonts.gstatic.com/s/bangers/v13/FeVQS0BTqb0h60ACL5la2bxii28.ttf";
              const boxShadow = preset.boxShadow || {
                color: "transparent",
                x: 0,
                y: 0,
                blur: 0,
              };
              const textTransform = preset.textTransform || "none";
              const textAlign = preset.textAlign || "center";
              const isKeywordColor = preset.isKeywordColor || "transparent";
              const preservedColorKeyWord =
                preset.preservedColorKeyWord ?? false;

              const x = boxShadow.x;
              const y = boxShadow.y;

              const CUSTOM_ANIMATIONS_CAPTIONS = [
                "charTypewriter",
                "scaleMidCaption",
                "scaleDownCaption",
                "upDownCaption",
                "upLeftCaption",
                "fadeByWord",
                "slideFadeByWord",
              ];

              const clipDuration = clip.display.to - clip.display.from;
              const getAnimationObjects = (animation: string) => {
                if (!animation || animation === "undefined") return [];
                return [
                  {
                    type: animation,
                    opts: {
                      duration: CUSTOM_ANIMATIONS_CAPTIONS.includes(animation)
                        ? clipDuration
                        : clipDuration * 0.2,
                      delay: 0,
                    },
                  },
                ];
              };

              clip.animations = getAnimationObjects(preset.animation || "");

              clip.style = {
                ...clip.style,
                color: preset.color || clip.style.color,
                fontFamily: fontFamily,
                fontUrl: fontUrl,
                align: textAlign,
                stroke: {
                  ...clip.style.stroke,
                  color: preset.borderColor || clip.style.stroke?.color,
                  width:
                    preset.borderWidth !== undefined
                      ? preset.borderWidth
                      : clip.style.stroke?.width,
                },
                shadow: {
                  ...clip.style.shadow,
                  color: boxShadow.color,
                  alpha: 0.5,
                  blur: boxShadow.blur,
                  distance: Math.sqrt(x * x + y * y) || 4,
                  angle: Math.PI / 4,
                },
                animation: preset.animation || clip.style.animation,
                textCase: textTransform,
                wordAnimation: preset.wordAnimation || clip.style.wordAnimation,
              };

              clip.caption = {
                ...clip.caption,
                colors: {
                  ...clip.caption?.colors,
                  appeared:
                    preset.appearedColor || clip.caption?.colors?.appeared,
                  active: preset.activeColor || clip.caption?.colors?.active,
                  activeFill:
                    preset.activeFillColor || clip.caption?.colors?.activeFill,
                  background:
                    preset.backgroundColor || clip.caption?.colors?.background,
                  keyword: isKeywordColor,
                },
                preserveKeywordColor: preservedColorKeyWord,
              };

              if (preset.type === "word") {
                clip.wordsPerLine = "single";
              } else {
                clip.wordsPerLine = "multiple";
              }
            }
          });
          setProject(newProject);
          setLoading(true);
        }
      };

      setLoading(true);
      applyCaptions();
      return;
    }

    setProject(newProject);
    setLoading(true); // Re-trigger loading overlay for the player update
  };

  const handleCustomApply = (data: any, category: string) => {
    if (!project) return;
    const newProject = JSON.parse(JSON.stringify(project));

    if (category === "Animation") {
      const imageClip = newProject.clips.find((c: any) => c.type === "Image");
      if (imageClip) {
        imageClip.animations = [
          {
            type: data.type,
            opts: data.opts,
            params: data.params,
          },
        ];
        toast.success("Animation applied to preview");
      }
    } else if (category === "Effect") {
      const effectClip = newProject.clips.find((c: any) => c.type === "Effect");
      if (effectClip) {
        effectClip.effect = {
          ...effectClip.effect,
          key: "custom",
          name: data.label,
          fragment: data.fragment,
        };
        toast.success("Custom effect applied to preview");
      }
    } else if (category === "Transition") {
      const transitionClip = newProject.clips.find(
        (c: any) => c.type === "Transition",
      );
      if (transitionClip) {
        transitionClip.transitionEffect = {
          ...transitionClip.transitionEffect,
          key: "custom",
          name: data.label,
          fragment: data.fragment,
        };
        toast.success("Custom transition applied to preview");
      }
    }

    setProject(newProject);
    setLoading(true);
  };

  const handleSave = async (data: any, category: string) => {
    if (!session) {
      toast.error("Please log in to save your presets");
      router.push("/signin");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/custom-presets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: data.label || `My ${category} ${myPresets.length + 1}`,
          category: category.toLowerCase(),
          data: data,
        }),
      });

      if (response.ok) {
        toast.success(`${category} saved successfully!`);
        fetchMyPresets();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to save preset");
      }
    } catch (error) {
      console.error("Error saving preset:", error);
      toast.error("An error occurred while saving");
    } finally {
      setIsSaving(false);
    }
  };

  const handleMyPresetClick = (preset: any) => {
    const category = preset.category.toLowerCase();
    if (category === "animations" || category === "animation") {
      handleCustomApply(preset.data, "Animation");
    } else if (category === "effects" || category === "effect") {
      handleCustomApply(preset.data, "Effect");
    } else if (category === "transitions" || category === "transition") {
      handleCustomApply(preset.data, "Transition");
    } else if (category === "captions" || category === "caption") {
      handlePresetSelect(preset.data, "Caption");
    }
  };

  return (
    <div className="max-w-7xl mx-auto w-full px-4 py-8">
      <div className="flex flex-col md:flex-row gap-8">
        <div className="flex-1 min-w-0">
          <Tabs defaultValue="templates" className="w-full">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Gallery</h1>
                <p className="text-muted-foreground mt-1">
                  Explore and use our library of presets.
                </p>
              </div>
              <TabsList className="grid w-[600px] grid-cols-3">
                <TabsTrigger value="templates">Templates</TabsTrigger>
                <TabsTrigger value="custom">Custom</TabsTrigger>
                <TabsTrigger value="my-presets">My Presets</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="templates" className="mt-0">
              <Tabs
                value={activeCategory}
                onValueChange={setActiveCategory}
                className="w-full"
              >
                <TabsList className="w-full justify-start bg-transparent border-b rounded-none h-auto p-0 mb-6">
                  <TabsTrigger
                    value="animations"
                    className="relative h-10 rounded-none border-b-2 border-b-transparent bg-transparent px-4 pb-3 pt-2 font-semibold text-muted-foreground data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                  >
                    Animations
                  </TabsTrigger>
                  <TabsTrigger
                    value="effects"
                    className="relative h-10 rounded-none border-b-2 border-b-transparent bg-transparent px-4 pb-3 pt-2 font-semibold text-muted-foreground data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                  >
                    Effects
                  </TabsTrigger>
                  <TabsTrigger
                    value="transitions"
                    className="relative h-10 rounded-none border-b-2 border-b-transparent bg-transparent px-4 pb-3 pt-2 font-semibold text-muted-foreground data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                  >
                    Transitions
                  </TabsTrigger>
                  <TabsTrigger
                    value="captions"
                    className="relative h-10 rounded-none border-b-2 border-b-transparent bg-transparent px-4 pb-3 pt-2 font-semibold text-muted-foreground data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                  >
                    Captions
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="animations">
                  <ScrollArea className="h-[600px] p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {ANIMATION_PRESETS.map((preset) => (
                        <PresetCard
                          key={preset.value}
                          label={preset.label}
                          category="Animation"
                          isActive={selectedPreset === preset.value}
                          image={preset.previewStatic}
                          onClick={() =>
                            handlePresetSelect(preset, "Animation")
                          }
                        />
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="effects">
                  <ScrollArea className="h-[600px] p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {effects.map((effect) => (
                        <PresetCard
                          key={effect.key}
                          label={effect.label}
                          image={effect.previewStatic}
                          category="Effect"
                          isActive={selectedPreset === effect.key}
                          onClick={() => handlePresetSelect(effect, "Effect")}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="transitions">
                  <ScrollArea className="h-[600px] p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {transitions.map((transition) => (
                        <PresetCard
                          key={transition.key}
                          label={transition.label}
                          image={transition.previewStatic}
                          category="Transition"
                          isActive={selectedPreset === transition.key}
                          onClick={() =>
                            handlePresetSelect(transition, "Transition")
                          }
                        />
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="captions">
                  <ScrollArea className="h-[600px] p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {STYLE_CAPTION_PRESETS.map((preset, index) => (
                        <PresetCard
                          key={index}
                          label={`Style ${index + 1}`}
                          video={preset.previewUrl}
                          category="Caption"
                          isActive={selectedPreset === `Style ${index + 1}`}
                          onClick={() => handlePresetSelect(preset, "Caption")}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </TabsContent>

            <TabsContent value="custom" className="mt-6">
              <Tabs
                value={activeCategory}
                onValueChange={setActiveCategory}
                className="w-full"
              >
                <TabsList className="w-full justify-start bg-transparent border-b rounded-none h-auto p-0 mb-6">
                  <TabsTrigger
                    value="animations"
                    className="relative h-9 rounded-none border-b-2 border-b-transparent bg-transparent px-4 pb-2 pt-1 text-sm font-medium text-muted-foreground data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                  >
                    Animations
                  </TabsTrigger>
                  <TabsTrigger
                    value="effects"
                    className="relative h-9 rounded-none border-b-2 border-b-transparent bg-transparent px-4 pb-2 pt-1 text-sm font-medium text-muted-foreground data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                  >
                    Effects
                  </TabsTrigger>
                  <TabsTrigger
                    value="transitions"
                    className="relative h-9 rounded-none border-b-2 border-b-transparent bg-transparent px-4 pb-2 pt-1 text-sm font-medium text-muted-foreground data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                  >
                    Transitions
                  </TabsTrigger>
                  <TabsTrigger
                    value="captions"
                    className="relative h-9 rounded-none border-b-2 border-b-transparent bg-transparent px-4 pb-2 pt-1 text-sm font-medium text-muted-foreground data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                  >
                    Captions
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="animations">
                  <CustomAnimationForm
                    onApply={(data) => handleCustomApply(data, "Animation")}
                    onSave={(data) => handleSave(data, "Animations")}
                    isSaving={isSaving}
                  />
                </TabsContent>

                <TabsContent value="effects">
                  <CustomShaderForm
                    type="Effect"
                    onApply={(data) => handleCustomApply(data, "Effect")}
                    onSave={(data) => handleSave(data, "Effects")}
                    isSaving={isSaving}
                  />
                </TabsContent>

                <TabsContent value="transitions">
                  <CustomShaderForm
                    type="Transition"
                    onApply={(data) => handleCustomApply(data, "Transition")}
                    onSave={(data) => handleSave(data, "Transitions")}
                    isSaving={isSaving}
                  />
                </TabsContent>

                <TabsContent value="captions">
                  <CustomCaptionForm
                    onApply={(data) => handlePresetSelect(data, "Caption")}
                    onSave={(data) => handleSave(data, "Captions")}
                    isSaving={isSaving}
                  />
                </TabsContent>
              </Tabs>
            </TabsContent>

            <TabsContent value="my-presets" className="mt-6">
              <Tabs
                value={activeCategory}
                onValueChange={setActiveCategory}
                className="w-full"
              >
                <TabsList className="w-full justify-start bg-transparent border-b rounded-none h-auto p-0 mb-6">
                  <TabsTrigger
                    value="animations"
                    className="relative h-9 rounded-none border-b-2 border-b-transparent bg-transparent px-4 pb-2 pt-1 text-sm font-medium text-muted-foreground data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                  >
                    Animations
                  </TabsTrigger>
                  <TabsTrigger
                    value="effects"
                    className="relative h-9 rounded-none border-b-2 border-b-transparent bg-transparent px-4 pb-2 pt-1 text-sm font-medium text-muted-foreground data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                  >
                    Effects
                  </TabsTrigger>
                  <TabsTrigger
                    value="transitions"
                    className="relative h-9 rounded-none border-b-2 border-b-transparent bg-transparent px-4 pb-2 pt-1 text-sm font-medium text-muted-foreground data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                  >
                    Transitions
                  </TabsTrigger>
                  <TabsTrigger
                    value="captions"
                    className="relative h-9 rounded-none border-b-2 border-b-transparent bg-transparent px-4 pb-2 pt-1 text-sm font-medium text-muted-foreground data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                  >
                    Captions
                  </TabsTrigger>
                </TabsList>

                <ScrollArea className="h-[500px] pr-4">
                  {myPresets.filter(
                    (p) =>
                      p.category.toLowerCase() === activeCategory ||
                      p.category.toLowerCase() ===
                        activeCategory.replace(/s$/, ""),
                  ).length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed rounded-xl">
                      <p className="text-muted-foreground">
                        No saved {activeCategory} yet.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {myPresets
                        .filter(
                          (p) =>
                            p.category.toLowerCase() === activeCategory ||
                            p.category.toLowerCase() ===
                              activeCategory.replace(/s$/, ""),
                        )
                        .map((preset) => (
                          <PresetCard
                            key={preset.id}
                            label={preset.name}
                            category={
                              preset.category.charAt(0).toUpperCase() +
                              preset.category.slice(1)
                            }
                            isActive={false}
                            onClick={() => handleMyPresetClick(preset)}
                          />
                        ))}
                    </div>
                  )}
                </ScrollArea>
              </Tabs>
            </TabsContent>
          </Tabs>
        </div>
        <div className="w-full md:w-80 flex flex-col gap-4">
          <div className="sticky top-8">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4 px-1">
              Preview
            </h2>
            <div className="relative rounded-xl overflow-hidden bg-muted">
              <ExamplePlayer
                project={project}
                onLoad={() => setLoading(false)}
                onReady={(studio) => {
                  studioRef.current = studio;
                }}
              />
              {loading && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs transition-opacity duration-300">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm font-medium text-white tracking-wide animate-pulse">
                      Loading player...
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const PresetCard = ({
  label,
  image,
  video,
  category,
  isActive,
  onClick,
}: {
  label: string;
  image?: string;
  video?: string;
  category: string;
  isActive?: boolean;
  onClick?: () => void;
}) => {
  return (
    <div
      onClick={onClick}
      className={`group relative rounded-xl border border-border bg-card overflow-hidden transition-all duration-300 hover:ring-2 hover:ring-primary/20 hover:shadow-xl cursor-pointer ${
        isActive
          ? "ring-2 ring-primary border-primary shadow-lg scale-[1.02]"
          : ""
      }`}
    >
      <div className="aspect-video w-full bg-muted relative overflow-hidden">
        {image && (
          <img
            src={image}
            alt={label}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        )}
        {video && (
          <video
            src={video}
            className="w-full h-full object-cover"
            autoPlay
            loop
            muted
            playsInline
          />
        )}
        {!image && !video && (
          <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-primary/10 to-primary/5">
            <Play className="w-8 h-8 text-primary/40" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <div className="p-2 rounded-full bg-primary text-primary-foreground shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
            <Play className="w-5 h-5 fill-current" />
          </div>
        </div>
      </div>
      <div className="p-4 bg-linear-to-b from-transparent to-black/5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-sm truncate">{label}</h3>
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary px-2 py-0.5 rounded-full bg-primary/10 whitespace-nowrap">
            {category}
          </span>
        </div>
      </div>
    </div>
  );
};

export default GalleryPage;
