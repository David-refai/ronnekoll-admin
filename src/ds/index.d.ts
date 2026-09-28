import type * as React from 'react';

type Tone = 'green' | 'blue' | 'violet' | 'amber' | 'orange' | 'red' | 'gray' | 'crimson' | 'primary';
type DeviceStatus = 'Tillgänglig' | 'Tilldelad' | 'Utlånad – tillfälligt' | 'Trasig' | 'Under reparation' | 'Kasserad' | 'Saknas';
type CaseStatus = 'Ny' | 'Pågår' | 'Pågående' | 'Väntar på del/leverantör' | 'Skickad på reparation' | 'Klar' | 'Avvisad';
type RequestStatus = 'Ny' | 'Behandlas' | 'Klart';
type LoanStatus = 'Aktiv' | 'Återlämnad' | 'Försenad';
type Priority = 'Låg' | 'Normal' | 'Hög' | 'Akut';
type SignatureStatus = 'Signerad' | 'Väntar signatur';
export type Status = DeviceStatus | CaseStatus | RequestStatus | LoanStatus | Priority | SignatureStatus;

/** Material Symbols Rounded ligature icon. */
export interface IconProps { name: string; size?: number; fill?: boolean; label?: string; className?: string; style?: React.CSSProperties }
export declare function Icon(props: IconProps): React.ReactElement;

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'filled' | 'tonal' | 'outlined' | 'text' | 'danger' | 'danger-text' | 'neutral';
  icon?: string; trailingIcon?: string; size?: 'md' | 'sm';
}
export declare function Button(props: ButtonProps): React.ReactElement;
export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { icon: string; label: string; variant?: 'standard' | 'filled' | 'tonal' | 'outlined'; badge?: number; fill?: boolean }
export declare function IconButton(props: IconButtonProps): React.ReactElement;
export interface FabProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { icon?: string; label?: string }
export declare function Fab(props: FabProps): React.ReactElement;
export interface SegmentOption { value: string; label: React.ReactNode; icon?: string }
export interface SegmentedButtonProps { options: SegmentOption[]; value: string | null; onChange?(value: string): void; label?: string }
export declare function SegmentedButton(props: SegmentedButtonProps): React.ReactElement;

export interface ChipProps { label: string; variant?: 'filter' | 'input' | 'assist'; selected?: boolean; onClick?(): void; onRemove?(): void; icon?: string; count?: number; dropdown?: boolean; className?: string }
export declare function Chip(props: ChipProps): React.ReactElement;
export interface FilterBarProps { children?: React.ReactNode; onClear?(): void; clearLabel?: string; trailing?: React.ReactNode }
export declare function FilterBar(props: FilterBarProps): React.ReactElement;
export interface SearchBarProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'onSubmit'> { shortcut?: string | false; onSubmit?(value: string): void; scanning?: boolean; size?: 'md' | 'lg' }
export declare function SearchBar(props: SearchBarProps): React.ReactElement;
export interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> { label?: string; helper?: string; error?: string; mono?: boolean; leadingIcon?: string; trailing?: React.ReactNode; multiline?: boolean; rows?: number }
export declare function TextField(props: TextFieldProps): React.ReactElement;
export interface SwitchProps { checked?: boolean; onChange?(checked: boolean): void; label?: React.ReactNode }
export declare function Switch(props: SwitchProps): React.ReactElement;
export interface YesNoProps { label: string; value: boolean | null; onChange?(value: boolean): void; danger?: boolean }
export declare function YesNo(props: YesNoProps): React.ReactElement;
export interface CheckboxProps { checked?: boolean; indeterminate?: boolean; onChange?(checked: boolean): void; label?: string; showLabel?: boolean }
export declare function Checkbox(props: CheckboxProps): React.ReactElement;

export interface StatusBadgeProps { status: Status; size?: 'md' | 'lg'; noIcon?: boolean; label?: string; className?: string }
export declare function StatusBadge(props: StatusBadgeProps): React.ReactElement;
export interface BadgeProps { tone?: Tone; icon?: string; size?: 'md' | 'lg'; children?: React.ReactNode; className?: string }
export declare function Badge(props: BadgeProps): React.ReactElement;
export interface TokenStatusProps { state?: 'valid' | 'expiring' | 'expired'; minutes?: number; onClick?(): void }
export declare function TokenStatus(props: TokenStatusProps): React.ReactElement;
export interface BannerProps { tone?: 'error' | 'warning' | 'info' | 'success'; title?: React.ReactNode; children?: React.ReactNode; action?: React.ReactNode; icon?: string }
export declare function Banner(props: BannerProps): React.ReactElement;
export interface AvatarProps { name: string; size?: 'md' | 'lg' }
export declare function Avatar(props: AvatarProps): React.ReactElement;

export interface NavItem { id: string; label: string; icon: string; count?: number }
export interface NavGroup { label: string; items: NavItem[] }
export interface NavDrawerProps { groups?: NavGroup[]; active?: string; collapsed?: boolean; onToggle?(): void; onSelect?(id: string): void }
export declare function NavDrawer(props: NavDrawerProps): React.ReactElement;
export interface TopBarProps { search?: React.ReactNode; tokenState?: TokenStatusProps['state']; tokenMinutes?: number; notifications?: number; dark?: boolean; onToggleTheme?(): void; user?: string; leading?: React.ReactNode }
export declare function TopBar(props: TopBarProps): React.ReactElement;
export interface PageHeaderProps { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; overline?: React.ReactNode }
export declare function PageHeader(props: PageHeaderProps): React.ReactElement;
export interface AppShellProps { active?: string; collapsed?: boolean; nav?: React.ReactNode; topbar?: React.ReactNode; banner?: React.ReactNode; fab?: React.ReactNode; children?: React.ReactNode }
export declare function AppShell(props: AppShellProps): React.ReactElement;
export interface TabsProps { tabs: { id?: string; label: string; icon?: string; count?: number }[]; value: string; onChange?(id: string): void }
export declare function Tabs(props: TabsProps): React.ReactElement;

export interface CardProps extends React.HTMLAttributes<HTMLElement> { interactive?: boolean; padding?: 'md' | 'sm' | 'none'; as?: keyof React.JSX.IntrinsicElements }
export declare function Card(props: CardProps): React.ReactElement;
export interface KpiCardProps { label: string; value: React.ReactNode; icon?: string; tone?: Tone; delta?: string; deltaTone?: 'green' | 'red' | 'amber' | 'violet'; onClick?(): void }
export declare function KpiCard(props: KpiCardProps): React.ReactElement;
export interface AttentionCardProps { count: number; title: string; description?: string; tone?: 'red' | 'amber' | 'blue' | 'green' | 'gray'; onClick?(): void }
export declare function AttentionCard(props: AttentionCardProps): React.ReactElement;
export interface Device { modell: string; produkt?: 'Chromebook' | 'PC' | 'iPad'; serienummer: string; assetId?: string; status: DeviceStatus; elev?: string; klass?: string; plats?: string }
export declare function DeviceCard(props: { device: Device; onClick?(): void }): React.ReactElement;
export interface Student { namn: string; epost: string; klass: string; skap?: string; tagg?: boolean; enhet?: string; lan?: number }
export declare function StudentCard(props: { student: Student; onClick?(): void }): React.ReactElement;
export interface Column<R> { key: string; label: string; sortable?: boolean; width?: number | string; align?: 'left' | 'right' | 'center'; mono?: boolean; render?(row: R): React.ReactNode }
export interface BulkAction { label: string; icon?: string; danger?: boolean; onClick?(): void }
export interface DataTableProps<R extends { id?: string | number }> {
  columns: Column<R>[]; rows: R[]; selectable?: boolean; selected?: (string | number)[]; onSelectionChange?(ids: (string | number)[]): void;
  bulkActions?: BulkAction[]; density?: 'comfortable' | 'compact'; sort?: { key: string; dir: 'asc' | 'desc' }; onRowClick?(row: R): void;
  toolbar?: React.ReactNode; footer?: React.ReactNode; maxHeight?: number | string; onSort?(key: string): void;
}
export declare function DataTable<R extends { id?: string | number }>(props: DataTableProps<R>): React.ReactElement;
export declare function BulkBar(props: { count: number; actions?: BulkAction[]; onClear?(): void }): React.ReactElement | null;
export interface TimelineEvent { type: 'tilldelning' | 'aterlamning' | 'utlaning' | 'status' | 'felanmalan' | 'inventering' | 'import' | 'kontrakt' | 'etikett'; title: React.ReactNode; time: string; user?: string; before?: Status; after?: Status }
export declare function Timeline(props: { events: TimelineEvent[] }): React.ReactElement;
export interface Fault { prioritet: Priority; datum: string; typ: string; beskrivning: string; bild?: string | boolean; enhet?: string; plats?: string; elev?: string; klass?: string }
export declare function FaultCard(props: { fault: Fault; onClick?(): void }): React.ReactElement;
export interface KanbanBoardProps<T> { columns: { status: CaseStatus | RequestStatus; items: T[] }[]; renderCard?(item: T, index: number): React.ReactNode }
export declare function KanbanBoard<T = Fault>(props: KanbanBoardProps<T>): React.ReactElement;
export declare function ChartCard(props: { title: string; subtitle?: string; action?: React.ReactNode; children?: React.ReactNode }): React.ReactElement;
export interface DonutProps { data: { label: string; value: number; tone: Tone }[]; size?: number; centerValue?: React.ReactNode; centerLabel?: string; label?: string }
export declare function Donut(props: DonutProps): React.ReactElement;

export interface DialogProps { open?: boolean; onClose?(): void; icon?: string; title: React.ReactNode; children?: React.ReactNode; actions?: React.ReactNode; tone?: 'default' | 'danger' | 'warning'; inline?: boolean }
export interface DialogOptionProps { icon: string; title: string; description?: string; selected?: boolean; onClick?(): void }
export declare const Dialog: ((props: DialogProps) => React.ReactElement | null) & { Option(props: DialogOptionProps): React.ReactElement };
export interface SideSheetProps { open?: boolean; onClose?(): void; title: React.ReactNode; overline?: React.ReactNode; subtitle?: React.ReactNode; children?: React.ReactNode; actions?: React.ReactNode; wide?: boolean; inline?: boolean }
export declare function SideSheet(props: SideSheetProps): React.ReactElement | null;
export declare function BottomSheet(props: { open?: boolean; onClose?(): void; title?: React.ReactNode; children?: React.ReactNode; inline?: boolean }): React.ReactElement | null;
export interface SnackbarProps { message: React.ReactNode; actionLabel?: string | false; onAction?(): void; onClose?(): void; icon?: string }
export declare function Snackbar(props: SnackbarProps): React.ReactElement;
export interface CommandItem { icon: string; label: string; hint?: string; badge?: Status; shortcut?: string }
export declare function CommandPalette(props: { query?: string; onQuery?(q: string): void; groups: { label: string; items: CommandItem[] }[]; activeIndex?: number }): React.ReactElement;
export declare function Stepper(props: { steps: (string | { label: string; hint?: string; error?: boolean })[]; current: number; vertical?: boolean }): React.ReactElement;

export interface ScanFeedbackProps { state?: 'idle' | 'success' | 'warning' | 'error'; title?: string; serial?: string; detail?: React.ReactNode; action?: React.ReactNode }
export declare function ScanFeedback(props: ScanFeedbackProps): React.ReactElement;
export declare function ScanCounters(props: { items: { label: string; value: number; total?: number; tone?: 'gray' | 'green' | 'red' | 'amber'; icon?: string }[] }): React.ReactElement;

export declare function SignaturePad(props: { label?: string; signer?: string; date?: string; signed?: boolean; onClear?(): void; onSign?(canvas: HTMLCanvasElement): void }): React.ReactElement;
export declare function PdfPreview(props: { fileName?: string; page?: number; pages?: number; children?: React.ReactNode }): React.ReactElement;
export interface LabelFields { qr?: boolean; barcode?: boolean; assetId?: boolean; modell?: boolean; skola?: boolean; elev?: boolean }
export declare function LabelPreview(props: { device: Pick<Device, 'serienummer' | 'assetId' | 'modell' | 'elev' | 'klass'>; template?: '62x29' | '54x17' | 'a4-3x8'; fields?: LabelFields }): React.ReactElement;

export declare function EmptyState(props: { icon?: string; title: string; description?: string; action?: React.ReactNode; tone?: 'red' | 'amber' | 'green' | 'gray'; compact?: boolean }): React.ReactElement;
export declare function Skeleton(props: { variant?: 'text' | 'rect' | 'circle'; width?: number | string; height?: number | string; lines?: number }): React.ReactElement;

export declare const STATUS: Record<Status, [Tone, string]>;
export declare const NAV: NavGroup[];

declare global {
  interface Window {
    RonneKoll: {
      Icon: typeof Icon; Button: typeof Button; IconButton: typeof IconButton; Fab: typeof Fab; SegmentedButton: typeof SegmentedButton;
      Chip: typeof Chip; FilterBar: typeof FilterBar; SearchBar: typeof SearchBar; TextField: typeof TextField; Switch: typeof Switch; YesNo: typeof YesNo; Checkbox: typeof Checkbox;
      StatusBadge: typeof StatusBadge; Badge: typeof Badge; TokenStatus: typeof TokenStatus; Banner: typeof Banner; Avatar: typeof Avatar;
      NavDrawer: typeof NavDrawer; TopBar: typeof TopBar; PageHeader: typeof PageHeader; AppShell: typeof AppShell; Tabs: typeof Tabs;
      Card: typeof Card; KpiCard: typeof KpiCard; AttentionCard: typeof AttentionCard; DeviceCard: typeof DeviceCard; StudentCard: typeof StudentCard;
      DataTable: typeof DataTable; BulkBar: typeof BulkBar; Timeline: typeof Timeline; KanbanBoard: typeof KanbanBoard; FaultCard: typeof FaultCard; ChartCard: typeof ChartCard; Donut: typeof Donut;
      Dialog: typeof Dialog; SideSheet: typeof SideSheet; BottomSheet: typeof BottomSheet; Snackbar: typeof Snackbar; CommandPalette: typeof CommandPalette; Stepper: typeof Stepper;
      ScanFeedback: typeof ScanFeedback; ScanCounters: typeof ScanCounters; SignaturePad: typeof SignaturePad; PdfPreview: typeof PdfPreview; LabelPreview: typeof LabelPreview;
      EmptyState: typeof EmptyState; Skeleton: typeof Skeleton; STATUS: typeof STATUS; NAV: typeof NAV;
    };
  }
}
