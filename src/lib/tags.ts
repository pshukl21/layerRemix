// Parses a comma-separated tag input string into a clean list of tags.
// Strips any leading '#' characters the user might type — every place
// that displays a tag already prepends '#' itself, so a tag stored as
// "#XXXX" would render as "##XXXX" otherwise. Used everywhere tags are
// parsed from raw text input, so this can't drift between forms.
export function parseTagsInput(input: string): string[] {
  return input
    .split(',')
    .map((t) => t.trim().replace(/^#+/, ''))
    .filter((t) => t !== '');
}
