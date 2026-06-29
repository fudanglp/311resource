export type ResourceHintSummary = {
  shadow_names: number;
  objs_object_types: number;
  objs_object_types_with_shadow_candidate: number;
  map_grid_runtime_members: number;
  map_grid_related_symbols: number;
  person_catalog_fields: number;
  skill_catalog_fields: number;
};

export type CoverageSummary = {
  source: string;
  file_size: number;
  entry_count: number;
  parsed_entries: number;
  parsed_payload_ratio: number;
  recognized_entries: number;
  recognized_payload_ratio: number;
  raw_entries: number;
  raw_payload_ratio: number;
};

export type SignatureSummary = {
  source: string;
  signature_hex: string;
  signature_text: string;
  status: string;
  entry_count: number;
  total_bytes: number;
  payload_ratio: number;
  examples: string;
};

export type ShexField = {
  source: string;
  entry: number;
  field: number;
  min_value: number;
  max_value: number;
  unique_values: number;
  top_values: string;
  image: string;
};

export type MapGridMember = {
  struct: string;
  offset: string;
  member: string;
  comment: string;
  repeatable_comment: string;
  typeinfo_hex: string;
};

export type ObjectShadowCandidate = {
  object_type: number;
  record_count: number;
  candidate_shadow_name: string;
  candidate_basis: string;
  groups: string;
  rotations: string;
  x_min: number;
  x_max: number;
  y_min: number;
  y_max: number;
  note: string;
};

export type ObjectRecord = {
  source: string;
  entry: number;
  record_index: number;
  flag: number;
  group: number;
  unknown_02: number;
  x: number;
  y: number;
  object_type: number;
  rotation: number;
  unknown_12: number;
  raw_hex: string;
};

export type FaceRecord = {
  index: number;
  offset: number;
  size: number;
  unknown: number;
  width: number;
  height: number;
  bpp: number;
  output: string;
};

export type WftxImageRecord = {
  source: string;
  index: number;
  width: number;
  height: number;
  bpp: number;
  output: string;
  note: string;
};

export type ModelRecord = {
  source: string;
  entry: number;
  size: number;
  vertex_count: number;
  index_count: number;
  triangle_count: number;
  bbox_min_x: number;
  bbox_min_y: number;
  bbox_min_z: number;
  bbox_max_x: number;
  bbox_max_y: number;
  bbox_max_z: number;
  obj: string;
  texture: string;
  note: string;
};

export type AimgRecord = {
  source: string;
  entry: number;
  group: number;
  frame: number;
  record_index: number;
  value: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type StructCatalogField = {
  struct: string;
  offset: string;
  size_guess: string;
  field: string;
  label: string;
  comment: string;
  repeatable_comment: string;
  typeinfo_hex: string;
};
