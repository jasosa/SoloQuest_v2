/**
 * Files whose interface text is all routed through `t` (decision 92). The coverage test fails when
 * one of them gets a literal. Add a file here when `npm run i18n -- report --all --clean` lists it.
 */
export const COVERED: readonly string[] = [
  'src/main.tsx',
  'src/ui/board/Furniture.tsx',
  'src/ui/board/ZargonOverlay.tsx',
  'src/ui/editor/ActionDialog.tsx',
  'src/ui/editor/ActionsPanel.tsx',
  'src/ui/editor/ActionsSection.tsx',
  'src/ui/editor/FeatureFields.tsx',
  'src/ui/editor/FeaturesPanel.tsx',
  'src/ui/editor/MonsterLists.tsx',
  'src/ui/editor/MonstersTab.tsx',
  'src/ui/editor/ProblemsPanel.tsx',
  'src/ui/editor/QuestTabs.tsx',
  'src/ui/editor/TileArt.tsx',
  'src/ui/FitToScreen.tsx',
  'src/ui/play/ForThisQuest.tsx',
  'src/ui/play/QuestSheet.tsx',
  'src/ui/select/SelectScreen.tsx',
  'src/ui/select/TeamPicker.tsx',
  'src/ui/shared/Frame.tsx',
  'src/ui/shared/MarginNote.tsx',
  'src/ui/shared/NoteCard.tsx',
  'src/ui/shared/Toast.tsx',
  'src/ui/theme/draw.tsx',
  'src/ui/theme/PackPreview.tsx',
  'src/ui/translations/TranslationEditor.tsx',
  'src/ui/translations/TranslationsDialog.tsx',
];
