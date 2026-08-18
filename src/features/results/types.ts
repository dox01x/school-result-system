export * from "@/types/result";

export interface PublishResultPayload {
  exam_id: string;
  class_id?: string;
  is_published: boolean;
}
