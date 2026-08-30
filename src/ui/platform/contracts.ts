export interface FieldDefinition {
  _id: string;
  name: string;
  type: string;
}

export interface ListSummary {
  _id: string;
  name: string;
  fieldDefinitions?: readonly FieldDefinition[];
}

export interface StageSummary {
  _id: string;
  name?: string;
}

export interface ListItem {
  _id: string;
  name: string;
  description?: string;
  stageId?: string;
  customFields?: readonly Readonly<{ fieldId: string; value: unknown }>[];
}

export interface ListInfo {
  list: ListSummary;
  stages: readonly StageSummary[];
}

export interface ItemsQuery {
  listId: string;
  text?: string;
  updatedAtGte?: string;
  cursor?: string;
  count: number;
}

export interface ItemsPage {
  items: readonly ListItem[];
  nextCursor: string | null;
}

export interface BoundedItems {
  items: readonly ListItem[];
  truncated: boolean;
}

export interface CreateListInput {
  roomId: string;
  name: string;
  description?: string;
  fieldDefinitions: readonly Readonly<{ fieldId?: string; name: string; type: string }>[];
  stages?: readonly Readonly<{ name: string; color?: string }>[];
  isolatedList?: boolean;
}

export interface CreatedList {
  list: ListSummary;
  defaultStage?: StageSummary;
  stages: readonly StageSummary[];
}

export interface AddFieldInput {
  listId: string;
  fieldId?: string;
  name: string;
  type: string;
}

export interface CreateItemInput {
  listId: string;
  title: string;
  description?: string;
  stageId: string;
  customFields: readonly Readonly<{ fieldId: string; value: unknown }>[];
}

export interface UpdateItemInput {
  itemId: string;
  title: string;
  description?: string;
  customFields: readonly Readonly<{ fieldId: string; value: unknown }>[];
}

export interface ListsClient {
  readonly capabilities: Readonly<{ stageMovement: boolean }>;
  listByRoom(roomId: string): Promise<readonly ListSummary[]>;
  getInfo(listId: string): Promise<ListInfo>;
  queryItems(input: ItemsQuery): Promise<ItemsPage>;
  listItemsBounded(listId: string): Promise<BoundedItems>;
  createList(input: CreateListInput): Promise<CreatedList>;
  addField(input: AddFieldInput): Promise<FieldDefinition>;
  createItem(input: CreateItemInput): Promise<ListItem>;
  updateItem(input: UpdateItemInput): Promise<ListItem>;
  moveItemToStage(itemId: string, stageId: string): Promise<ListItem>;
  deleteItem(itemId: string): Promise<void>;
}

export interface RoomFile {
  _id: string;
  name: string;
  size?: number;
  mimeType?: string;
}

export interface UploadInput {
  roomId: string;
  fileName: string;
  base64Data: string;
  mimeType: string;
}

export interface FolderUploadInput extends UploadInput {
  folderId: string;
}

export type UploadedFile = RoomFile;

export interface FilesClient {
  readonly capabilities: Readonly<{ folderScopedRead: boolean; folderScopedWrite: boolean }>;
  listRoomFiles(roomId: string): Promise<readonly RoomFile[]>;
  listFolderFiles(roomId: string, folderId: string): Promise<readonly RoomFile[]>;
  readFile(fileId: string, fileName: string): Promise<string>;
  upload(input: UploadInput): Promise<UploadedFile>;
  uploadToFolder(input: FolderUploadInput): Promise<UploadedFile>;
}

export interface FolderRef {
  _id: string;
  name: string;
}

export interface FoldersClient {
  readonly capabilities: Readonly<{ ensurePath: boolean; findByPath: boolean }>;
  ensurePath(roomId: string, segments: readonly string[]): Promise<FolderRef>;
  findByPath(roomId: string, segments: readonly string[]): Promise<FolderRef | null>;
}

export interface AiMessageInput {
  roomId: string;
  content: string;
  flowChatId?: string;
  sessionId?: string;
  fileIds?: readonly string[];
}

export interface AiMessageDispatch {
  sessionId: string;
  aiMessageId?: string;
}

export interface AiMessage {
  _id: string;
  status?: string;
  content?: string;
  createdAt?: string;
}

export interface SandboxClient {
  sendAiMessage(input: AiMessageInput): Promise<AiMessageDispatch>;
  listAiMessages(sessionId: string, count: number): Promise<readonly AiMessage[]>;
}

export interface RoomClients {
  lists: ListsClient;
  files: FilesClient;
  folders: FoldersClient;
  sandbox: SandboxClient;
}

/** Non-secret display context returned by the current-user browser bridge. */
export interface CurrentRoomContext {
  userId: string;
  roomId: string;
  roomSlug: string;
  appId: string;
  appUrl: string;
}
