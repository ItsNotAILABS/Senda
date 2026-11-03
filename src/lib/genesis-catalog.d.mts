export type GenesisCharacter={id:string;name:string;title:string;runtime:string;accent:string;rarity:string;summary:string;mission:string;tools:string[];gear:string;pack:string};
export type GenesisAsset={id:string;name:string;character:string;slot:string;rarity:string;capability:string|null;description:string};
export declare const CHARACTERS:readonly GenesisCharacter[];
export declare const GEAR:readonly GenesisAsset[];
export declare const CODE_PACKS:readonly GenesisAsset[];
export declare const DIGITAL_ASSETS:readonly GenesisAsset[];
export declare function findCharacter(id:string):GenesisCharacter|null;
export declare function findAsset(id:string):GenesisAsset|null;
export declare function blueprintMetadata(id:string,baseUrl:string):Record<string,unknown>;
