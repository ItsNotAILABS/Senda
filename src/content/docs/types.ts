export type DocBlock = { h: string; p: string[] };
export type DocPage = { id: string; title: string; body: DocBlock[] };
export type DocBook = { id: string; label: string; lede: string; pages: DocPage[] };
