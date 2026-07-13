import type { Metadata } from "next";

import { ImageStudio } from "@/components/chat/image-studio";
import { APP_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Create image · ${APP_NAME}`,
};

export default function ImagesPage() {
  return <ImageStudio />;
}
