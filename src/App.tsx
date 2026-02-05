import { supabase } from './supabaseClient'; // Certifique-se que o caminho está certo
import React, { useState, useReducer, useEffect, useRef } from 'react';
import { 
  AlertTriangle, Zap, Search, History, 
  XCircle, RotateCcw, Swords, FileText, ChevronRight, Gavel,
  Layers, MousePointerClick, Check, ShieldAlert,
  Flame, Droplets, Leaf, Eye, Moon, Star, Hexagon, Component, Heart, Scale,
  HeartPulse, Sparkles, MessageSquare, Bot, ArrowUpCircle, Info, ScanLine, Edit3, X,
  Plus, Minus, RefreshCw, PanelLeftClose, PanelLeft, UserCheck, Trophy, RotateCcw as RestartIcon, Trash2,
  Lightbulb, Send, Target, BarChart3, User, BookOpen, PlayCircle, Download, Coins, Skull, Briefcase
} from 'lucide-react';

// --- SISTEMA DE ÁUDIO ---
const playSound = (type: 'attack' | 'damage' | 'energy' | 'click' | 'knockout' | 'coin', customVolume = 0.4, speed = 1.0) => {
  const sounds = {
    attack: 'sounds/attack.mp3',
    damage: 'sounds/damage.mp3',
    energy: 'sounds/energy.mp3',
    click: 'sounds/click.mp3',
    knockout: 'sounds/knockout.mp3',
    coin: 'sounds/coin.mp3', 
  };

  const soundPath = sounds[type];
  if (!soundPath) return;

  const audio = new Audio(soundPath);
  audio.volume = customVolume;
  audio.playbackRate = speed;
  audio.preservesPitch = false; 

  audio.play().catch((err) => {});
};

// --- CONFIGURAÇÃO ---
const apiKey = ""; 

// --- TIPAGEM ---
type PlayerId = 'P1' | 'P2';
type Phase = 'SETUP' | 'DRAW' | 'MAIN' | 'ATTACK' | 'BETWEEN_TURNS';
type Severity = 'INFO' | 'WARNING' | 'CRITICAL';
type SpecialCondition = 'NONE' | 'ASLEEP' | 'BURNED' | 'CONFUSED' | 'PARALYZED' | 'POISONED';
type InteractionMode = 'NONE' | 'ATTACH_ENERGY' | 'PROMOTE' | 'RETREAT_PAY_COST' | 'RETREAT_SELECT_NEW_ACTIVE' | 'DISTRIBUTE_DAMAGE';
type EnergyType = 'GRASS' | 'FIRE' | 'WATER' | 'LIGHTNING' | 'PSYCHIC' | 'FIGHTING' | 'DARKNESS' | 'METAL' | 'FAIRY' | 'DRAGON' | 'COLORLESS';

interface Attack { name: string; cost: EnergyType[]; damage: string; text: string; }
interface Ability { name: string; text: string; type: 'Ability'; }
interface Tool { name: string; type: 'TOOL'; effect: 'HP_BOOST' | 'DMG_BOOST' | 'RETREAT_REDUCE' | 'ENERGY_RETAIN' | 'DEVOLUTION' | 'EVOLUTION'; value: number; text: string; condition?: string; }

interface CardData {
    maxHP: number; type: EnergyType; abilities?: Ability[]; attacks: Attack[];
    weakness?: EnergyType; resistance?: EnergyType; retreatCost: number;
    evolvesTo?: string[]; prizeCount?: number;
    tool?: Tool;
}
interface DeckTheme {
  id: string; name: string; color: string; textColor: string; gradient: string;
  acePokemon: string[]; validEnergies: EnergyType[];
}
interface PokemonState {
  id: string; name: string; maxHP: number; damage: number; energies: EnergyType[];
  condition: SpecialCondition; isEvolved: boolean; turnsInPlay: number;
  isKnockedOut: boolean; type: EnergyType; abilities?: Ability[]; attacks: Attack[];
  weakness?: EnergyType; resistance?: EnergyType; retreatCost: number;
  hasDetailsLoaded: boolean; evolvesTo?: string[]; prizeCount: number;
  tool?: Tool | null;
}
interface PlayerState {
  id: PlayerId; name: string; deckTheme: DeckTheme | null; prizesLeft: number;
  deckCount: number; handCount: number; active: PokemonState | null; bench: PokemonState[];
  mustPromote: boolean; energyAttachedThisTurn: boolean; supporterPlayedThisTurn: boolean;
  retreatedThisTurn: boolean; stadiumPlayedThisTurn: boolean;
}
interface GameEvent {
  id: string; timestamp: string; turnNumber: number; playerId: PlayerId; playerName: string;
  actionType: string; description: string; severity: Severity; metadata?: any;
}
interface GameState {
  matchId: string; turnNumber: number; currentPlayer: PlayerId; phase: Phase;
  players: Record<PlayerId, PlayerState>; events: GameEvent[]; winner: PlayerId | null;
}
interface DeckStat { deckId: string; deckName: string; wins: number; matches: number; }
interface PlayerStat { playerName: string; wins: number; matches: number; }

// --- DADOS ---
const ENERGY_CONFIG: Record<EnergyType, { color: string, bg: string, icon: React.ElementType, label: string }> = {
  GRASS: { color: 'text-green-600', bg: 'bg-green-600', icon: Leaf, label: 'Grama' },
  FIRE: { color: 'text-red-600', bg: 'bg-red-600', icon: Flame, label: 'Fogo' },
  WATER: { color: 'text-blue-600', bg: 'bg-blue-600', icon: Droplets, label: 'Água' },
  LIGHTNING: { color: 'text-yellow-500', bg: 'bg-yellow-500', icon: Zap, label: 'Elétrico' },
  PSYCHIC: { color: 'text-purple-600', bg: 'bg-purple-600', icon: Eye, label: 'Psíquico' },
  FIGHTING: { color: 'text-orange-700', bg: 'bg-orange-700', icon: Swords, label: 'Luta' },
  DARKNESS: { color: 'text-slate-800', bg: 'bg-slate-800', icon: Moon, label: 'Escuridão' },
  METAL: { color: 'text-gray-500', bg: 'bg-gray-500', icon: Component, label: 'Metal' },
  FAIRY: { color: 'text-pink-400', bg: 'bg-pink-400', icon: Heart, label: 'Fada' },
  DRAGON: { color: 'text-yellow-700', bg: 'bg-yellow-700', icon: Hexagon, label: 'Dragão' },
  COLORLESS: { color: 'text-slate-500', bg: 'bg-slate-200', icon: Star, label: 'Incolor' },
};

// --- FERRAMENTAS ---
const TOOLS_DATABASE: Record<string, Tool> = {
    "Cinto da Bravura": { name: "Cinto da Bravura", type: 'TOOL', effect: 'HP_BOOST', value: 50, text: "+50 HP (Básicos)", condition: "BASIC_ONLY" },
    "Hero's Cape (Ace)": { name: "Hero's Cape (Ace)", type: 'TOOL', effect: 'HP_BOOST', value: 100, text: "+100 HP", condition: "NONE" },
    "Rescue Board": { name: "Rescue Board", type: 'TOOL', effect: 'RETREAT_REDUCE', value: 1, text: "Recuo -1", condition: "NONE" },
    "Heavy Baton": { name: "Heavy Baton", type: 'TOOL', effect: 'ENERGY_RETAIN', value: 0, text: "Retém Energia se 4 custo recuo", condition: "HEAVY_ONLY" },
    "Maximum Belt (Ace)": { name: "Maximum Belt (Ace)", type: 'TOOL', effect: 'DMG_BOOST', value: 50, text: "+50 Dano em ex", condition: "VS_EX" },
    "Defiance Band": { name: "Defiance Band", type: 'TOOL', effect: 'DMG_BOOST', value: 30, text: "+30 Dano se perdendo", condition: "BEHIND_PRIZES" },
    "Faixa de Escolha": { name: "Faixa de Escolha", type: 'TOOL', effect: 'DMG_BOOST', value: 30, text: "+30 Dano em V/ex", condition: "VS_V_EX" },
    "TM: Evolution": { name: "TM: Evolution", type: 'TOOL', effect: 'EVOLUTION', value: 0, text: "Ataque: Evolução", condition: "NONE" },
    "TM: Devolution": { name: "TM: Devolution", type: 'TOOL', effect: 'DEVOLUTION', value: 0, text: "Ataque: Devolução", condition: "NONE" }
};

const CARD_DATABASE: Record<string, any> = {
    "Charmander": { maxHP: 70, type: 'FIRE', retreatCost: 1, prizeCount: 1, weakness: 'WATER', evolvesTo: ['Charmeleon'], attacks: [{ name: "Brasa", cost: ['FIRE'], damage: "30", text: "Descarte uma energia." }] },
    "Charmeleon": { maxHP: 90, type: 'FIRE', retreatCost: 2, prizeCount: 1, weakness: 'WATER', evolvesTo: ['Charizard ex'], attacks: [{ name: "Lança-Chamas", cost: ['FIRE', 'FIRE', 'COLORLESS'], damage: "100", text: "Descarte uma energia." }] },
    "Charizard ex": { maxHP: 330, type: 'DARKNESS', retreatCost: 2, prizeCount: 2, weakness: 'GRASS', abilities: [{ name: "Reino Infernal", type: 'Ability', text: "Busque 3 energias de fogo no deck ao evoluir." }], attacks: [{ name: "Escuridão Ardente", cost: ['FIRE', 'FIRE'], damage: "180", text: "+30 por prêmio do oponente." }] },
    "Pidgey": { maxHP: 60, type: 'COLORLESS', retreatCost: 1, prizeCount: 1, attacks: [{ name: "Bater Asas", cost: ['COLORLESS'], damage: "10", text: "" }] },
    "Pidgeot ex": { maxHP: 280, type: 'COLORLESS', retreatCost: 0, prizeCount: 2, weakness: 'LIGHTNING', resistance: 'FIGHTING', abilities: [{ name: "Busca Rápida", type: 'Ability', text: "Busque qualquer carta no deck 1x por turno." }], attacks: [{ name: "Ventania Poderosa", cost: ['COLORLESS', 'COLORLESS'], damage: "120", text: "Descarte um estádio." }] },
    "Bibarel": { maxHP: 120, type: 'COLORLESS', retreatCost: 2, prizeCount: 1, weakness: 'FIGHTING', abilities: [{ name: "Incisivos Industriosos", type: 'Ability', text: "Compre até ter 5 na mão." }], attacks: [{ name: "Cauda Esmagadora", cost: ['COLORLESS', 'COLORLESS', 'COLORLESS'], damage: "80", text: "Moeda: Cara = Paralisado." }] },
    "Radiant Charizard": { maxHP: 160, type: 'FIRE', retreatCost: 3, prizeCount: 1, weakness: 'WATER', abilities: [{ name: "Coração Excitado", type: 'Ability', text: "-1 custo por prêmio do oponente." }], attacks: [{ name: "Combustão Explosiva", cost: ['FIRE', 'COLORLESS', 'COLORLESS', 'COLORLESS', 'COLORLESS'], damage: "250", text: "Não pode usar no próximo turno." }] },
    "Ralts": { maxHP: 60, type: 'PSYCHIC', retreatCost: 1, prizeCount: 1, weakness: 'DARKNESS', resistance: 'FIGHTING', evolvesTo: ['Kirlia'], attacks: [{ name: "Teleporte", cost: ['PSYCHIC'], damage: "10", text: "Troque este Pokémon." }] },
    "Kirlia": { maxHP: 80, type: 'PSYCHIC', retreatCost: 1, prizeCount: 1, weakness: 'DARKNESS', resistance: 'FIGHTING', evolvesTo: ['Gardevoir ex'], abilities: [{ name: "Refinamento", type: 'Ability', text: "Descarte 1, compre 2." }], attacks: [{ name: "Tapa", cost: ['PSYCHIC', 'COLORLESS'], damage: "30", text: "" }] },
    "Gardevoir ex": { maxHP: 310, type: 'PSYCHIC', retreatCost: 2, prizeCount: 2, weakness: 'DARKNESS', resistance: 'FIGHTING', abilities: [{ name: "Abraço Psíquico", type: 'Ability', text: "Ligue energia Psíquica do descarte e coloque 2 marcadores de dano." }], attacks: [{ name: "Força Milagrosa", cost: ['PSYCHIC', 'PSYCHIC', 'COLORLESS'], damage: "190", text: "Cura condições especiais." }] },
    "Drifloon": { maxHP: 70, type: 'PSYCHIC', retreatCost: 1, prizeCount: 1, weakness: 'DARKNESS', resistance: 'FIGHTING', attacks: [{ name: "Estouro de Balão", cost: ['COLORLESS', 'COLORLESS'], damage: "30x", text: "30x por marcador de dano neste Pokémon." }] },
    "Scream Tail": { maxHP: 90, type: 'PSYCHIC', retreatCost: 1, prizeCount: 1, weakness: 'DARKNESS', resistance: 'FIGHTING', attacks: [{ name: "Rugido da Selva", cost: ['PSYCHIC', 'COLORLESS'], damage: "0", text: "20 de dano a um oponente por marcador neste Pokémon." }] },
    "Cresselia": { maxHP: 120, type: 'PSYCHIC', retreatCost: 1, prizeCount: 1, weakness: 'DARKNESS', resistance: 'FIGHTING', attacks: [{ name: "Reversão do Brilho da Lua", cost: ['PSYCHIC'], damage: "0", text: "Mova 2 danos de cada um dos seus para o oponente." }, { name: "Explosão Lunar", cost: ['PSYCHIC', 'PSYCHIC', 'COLORLESS'], damage: "110", text: "" }] },
    "Lumineon V": { maxHP: 170, type: 'WATER', retreatCost: 1, prizeCount: 2, weakness: 'LIGHTNING', abilities: [{ name: "Sinal Luminoso", type: 'Ability', text: "Busque 1 Apoiador ao jogar da mão." }], attacks: [{ name: "Retorno Aquático", cost: ['WATER', 'COLORLESS', 'COLORLESS'], damage: "120", text: "Embaralhe este Pokémon." }] },
    "Mew": { maxHP: 60, type: 'PSYCHIC', retreatCost: 1, prizeCount: 1, weakness: 'DARKNESS', resistance: 'FIGHTING', abilities: [{ name: "Cauda Misteriosa", type: 'Ability', text: "Olhe topo 6, pegue 1 Item." }], attacks: [{ name: "Disparo Psíquico", cost: ['PSYCHIC', 'COLORLESS'], damage: "30", text: "" }] },
    "Radiant Greninja": { maxHP: 130, type: 'WATER', retreatCost: 1, prizeCount: 1, weakness: 'LIGHTNING', abilities: [{ name: "Cartas Ocultas", type: 'Ability', text: "Descarte energia, compre 2." }], attacks: [{ name: "Shuriken ao Luar", cost: ['WATER', 'WATER', 'COLORLESS'], damage: "0", text: "90 em 2 Pokémons." }] },
    "Dreepy": { maxHP: 60, type: 'DRAGON', retreatCost: 1, prizeCount: 1, evolvesTo: ['Drakloak'], attacks: [{ name: "Mordida", cost: ['FIGHTING'], damage: "10", text: "" }, {name: "Toque Leve", cost: ['PSYCHIC'], damage: "10", text: ""}] },
    "Drakloak": { maxHP: 90, type: 'DRAGON', retreatCost: 1, prizeCount: 1, evolvesTo: ['Dragapult ex'], abilities: [{ name: "Comando de Reconhecimento", type: 'Ability', text: "Olhe as 2 do topo, pegue 1."}], attacks: [{ name: "Cabeçada a Jato", cost: ['DRAGON'], damage: "40", text: "" }] },
    "Dragapult ex": { maxHP: 320, type: 'DRAGON', retreatCost: 1, prizeCount: 2, attacks: [{ name: "Cabeçada a Jato", cost: ['COLORLESS'], damage: "70", text: "Ignora efeitos." }, { name: "Mergulho Fantasma", cost: ['FIRE', 'PSYCHIC'], damage: "200", text: "Coloque 6 contadores de dano no banco." }] },
    "Xatu": { maxHP: 100, type: 'PSYCHIC', retreatCost: 1, prizeCount: 1, weakness: 'DARKNESS', resistance: 'FIGHTING', abilities: [{ name: "Clarividência", type: 'Ability', text: "Ligue 1 Psi da mão ao Banco e compre 2." }], attacks: [{ name: "Super Psy", cost: ['PSYCHIC', 'COLORLESS'], damage: "80", text: "" }] },
    "Natu": { maxHP: 50, type: 'PSYCHIC', retreatCost: 1, prizeCount: 1, weakness: 'DARKNESS', resistance: 'FIGHTING', evolvesTo: ['Xatu'], attacks: [{ name: "Bicada Dupla", cost: ['PSYCHIC'], damage: "10x", text: "Jogue 2 moedas. 10x cada cara." }] },
    "Radiant Alakazam": { maxHP: 130, type: 'PSYCHIC', retreatCost: 2, prizeCount: 1, weakness: 'DARKNESS', resistance: 'FIGHTING', abilities: [{ name: "Colheres Dolorosas", type: 'Ability', text: "Mova até 2 contadores de dano."}], attacks: [{name: "Dominador de Mentes", cost: ['PSYCHIC', 'COLORLESS'], damage: "20x", text: "20x por carta na mão do oponente."}] },
};

const LEAGUE_DECKS: DeckTheme[] = [
  { id: 'charizard-ex', name: 'Charizard ex', color: 'bg-orange-700', textColor: 'text-orange-100', gradient: 'from-orange-900 to-red-900', acePokemon: ['Charmander', 'Charmeleon', 'Charizard ex', 'Pidgey', 'Pidgeot ex', 'Bibarel', 'Radiant Charizard'], validEnergies: ['FIRE', 'COLORLESS'] },
  { id: 'gardevoir-ex', name: 'Gardevoir ex', color: 'bg-emerald-700', textColor: 'text-emerald-100', gradient: 'from-emerald-900 to-teal-900', acePokemon: ['Ralts', 'Kirlia', 'Gardevoir ex', 'Drifloon', 'Cresselia', 'Lumineon V', 'Mew', 'Radiant Greninja'], validEnergies: ['PSYCHIC', 'WATER', 'COLORLESS'] },
  { id: 'dragapult-ex', name: 'Dragapult ex', color: 'bg-indigo-800', textColor: 'text-indigo-100', gradient: 'from-indigo-950 to-purple-900', acePokemon: ['Dreepy', 'Drakloak', 'Dragapult ex', 'Natu', 'Xatu', 'Radiant Alakazam'], validEnergies: ['FIRE', 'PSYCHIC', 'COLORLESS', 'LIGHTNING'] }
];

const initialPokemon = (id: string, name: string): PokemonState => {
    const known = CARD_DATABASE[name];
    return {
      id, name, maxHP: known ? known.maxHP : 60, damage: 0, energies: [], condition: 'NONE', 
      isEvolved: false, turnsInPlay: 0, isKnockedOut: false, type: known ? known.type : 'COLORLESS', 
      attacks: known ? known.attacks : [], abilities: known ? known.abilities : [],
      retreatCost: known ? known.retreatCost : 1, weakness: known ? known.weakness : undefined,
      resistance: known ? known.resistance : undefined, hasDetailsLoaded: !!known, evolvesTo: known?.evolvesTo,
      prizeCount: known?.prizeCount || 1, tool: null
    };
};

const getInitialState = (): GameState => ({
  matchId: `MATCH-${Math.floor(Math.random() * 10000)}`, turnNumber: 1, currentPlayer: 'P1', phase: 'SETUP', winner: null,
  players: {
    P1: { id: 'P1', name: 'Jogador 1', prizesLeft: 6, deckCount: 60, handCount: 7, deckTheme: null, active: null, bench: [], energyAttachedThisTurn: false, supporterPlayedThisTurn: false, retreatedThisTurn: false, stadiumPlayedThisTurn: false, mustPromote: false },
    P2: { id: 'P2', name: 'Jogador 2', prizesLeft: 6, deckCount: 60, handCount: 7, deckTheme: null, active: null, bench: [], energyAttachedThisTurn: false, supporterPlayedThisTurn: false, retreatedThisTurn: false, stadiumPlayedThisTurn: false, mustPromote: false }
  }, events: []
});

const checkEnergyCost = (attached: EnergyType[], cost: EnergyType[]): boolean => {
    const available = [...attached];
    const specificCost = cost.filter(c => c !== 'COLORLESS');
    const colorlessCost = cost.filter(c => c === 'COLORLESS').length;
    for (const req of specificCost) {
        const idx = available.indexOf(req);
        if (idx === -1) return false;
        available.splice(idx, 1);
    }
    return available.length >= colorlessCost;
};

// --- REDUCER ---
function gameReducer(state: GameState, action: any): GameState {
  if (action.type === 'RESET_GAME') return getInitialState();

  const newState = {
      ...state,
      players: {
          P1: { ...state.players.P1, active: state.players.P1.active ? {...state.players.P1.active} : null, bench: state.players.P1.bench.map(p => ({...p})) },
          P2: { ...state.players.P2, active: state.players.P2.active ? {...state.players.P2.active} : null, bench: state.players.P2.bench.map(p => ({...p})) }
      },
      events: [...state.events]
  };

  const player = newState.players[state.currentPlayer];
  const opponentId = state.currentPlayer === 'P1' ? 'P2' : 'P1';
  let logEntry: GameEvent | null = null;
  let newEvents: GameEvent[] = [];
  
  const createLog = (text: string, severity: Severity = 'INFO') => ({ 
      id: crypto.randomUUID(), 
      timestamp: new Date().toLocaleTimeString(), 
      turnNumber: state.turnNumber, 
      playerId: state.currentPlayer, 
      playerName: newState.players[state.currentPlayer].name, 
      actionType: action.type, 
      description: text, 
      severity 
  });

  switch (action.type) {
    case 'SET_PLAYER_NAME': newState.players[action.playerId as PlayerId].name = action.name; break;
    case 'SET_DECK':
      const pState = newState.players[action.playerId as PlayerId];
      pState.deckTheme = LEAGUE_DECKS.find(d => d.id === action.deckId) || LEAGUE_DECKS[0];
      pState.active = null; 
      newState.players[action.playerId as PlayerId] = pState;
      break;
    case 'SET_ACTIVE':
      newState.players[action.playerId as PlayerId].active = initialPokemon(`${action.playerId}-active`, action.pokemonName);
      break;
    case 'NEXT_PHASE':
      if (state.players.P1.mustPromote || state.players.P2.mustPromote) { logEntry = createLog(`Impossível avançar: ${state.players[state.players.P1.mustPromote ? 'P1' : 'P2'].name} deve promover um Pokémon!`, 'CRITICAL'); break; }
      if (state.phase === 'SETUP') {
          if (!state.players.P1.active || !state.players.P2.active) { logEntry = createLog("Erro Setup: Defina Ativos.", 'CRITICAL'); break; }
          newState.phase = 'DRAW'; 
          logEntry = createLog("Fim da Preparação. Partida Iniciada!", 'INFO');
      } else {
          if (state.phase === 'BETWEEN_TURNS') {
               ['P1', 'P2'].forEach((pid) => {
                    const p = newState.players[pid as PlayerId];
                    if (p.active) {
                        // VENENO
                        if (p.active.condition === 'POISONED') { 
                            p.active.damage += 10; 
                            newEvents.unshift(createLog(`${p.name}: Sofreu 10 de dano por Veneno.`, 'WARNING')); 
                        }
                        // QUEIMADO
                        if (p.active.condition === 'BURNED') { 
                            p.active.damage += 20; 
                            newEvents.unshift(createLog(`${p.name}: Sofreu 20 de dano por Queimadura.`, 'WARNING')); 
                        }
                        
                        // Check Nocaute Pós-Condição
                        if (p.active && p.active.damage >= p.active.maxHP) {
                             const prizeTakerId = pid === 'P1' ? 'P2' : 'P1';
                             const prizes = p.active.prizeCount;
                             newState.players[prizeTakerId].prizesLeft = Math.max(0, newState.players[prizeTakerId].prizesLeft - prizes);
                             newEvents.unshift(createLog(`NOCAUTE (Checkup)! ${p.active.name} desmaiou por condição especial.`, 'CRITICAL'));
                             playSound('knockout');
                             p.active = null;
                             p.mustPromote = true;
                             if (p.bench.length === 0) { newState.winner = prizeTakerId; newEvents.unshift(createLog(`VITÓRIA! ${p.name} sem Pokémon.`, 'CRITICAL')); }
                             else if (newState.players[prizeTakerId].prizesLeft === 0) { newState.winner = prizeTakerId; newEvents.unshift(createLog(`VITÓRIA!`, 'CRITICAL')); }
                        }

                        // Checkups de Status
                        if (p.active) {
                            if (p.active.condition === 'BURNED') {
                                const flip = Math.random() > 0.5;
                                if (flip) { p.active.condition = 'NONE'; newEvents.unshift(createLog(`${p.name}: Curou Queimadura (CARA).`, 'INFO')); }
                                else { newEvents.unshift(createLog(`${p.name}: Continua Queimado (COROA).`, 'WARNING')); }
                            }
                            if (p.active.condition === 'ASLEEP') {
                                 const flip = Math.random() > 0.5;
                                 if (flip) { p.active.condition = 'NONE'; newEvents.unshift(createLog(`${p.name}: Acordou (CARA)!`, 'INFO')); }
                                 else { newEvents.unshift(createLog(`${p.name}: Dormindo (COROA)...`, 'WARNING')); }
                            }
                            if (p.active.condition === 'PARALYZED') { 
                                // A paralisia cura se o turno passou pelo jogador afetado
                                if (state.currentPlayer === pid) { 
                                    p.active.condition = 'NONE'; 
                                    newEvents.unshift(createLog(`${p.name}: Curou da paralisia.`, 'INFO')); 
                                } 
                            }
                        }
                    }
               });
          }
          const phases: Phase[] = ['SETUP', 'DRAW', 'MAIN', 'ATTACK', 'BETWEEN_TURNS'];
          let nextIdx = phases.indexOf(state.phase) + 1;
          if (state.phase === 'ATTACK' || (state.phase === 'MAIN' && action.type === 'NEXT_PHASE')) { 
              newState.phase = 'BETWEEN_TURNS'; 
              logEntry = createLog(`${player.name} encerrou o turno.`, 'INFO'); 
          } else if (state.phase === 'BETWEEN_TURNS') {
              if (!newState.winner) {
                  newState.turnNumber++; 
                  newState.currentPlayer = opponentId; 
                  newState.phase = 'DRAW';
                  const np = newState.players[newState.currentPlayer];
                  np.energyAttachedThisTurn = false; np.supporterPlayedThisTurn = false; np.retreatedThisTurn = false;
                  if (np.active) np.active.turnsInPlay++;
                  np.bench.forEach(p => p.turnsInPlay++);
                  logEntry = createLog(`Início Turno ${newState.turnNumber}: ${np.name}`, 'INFO');
              }
          } else { newState.phase = phases[nextIdx] as Phase; logEntry = createLog(`Fase: ${newState.phase}`, 'INFO'); }
      }
      break;
    case 'DRAW_CARD': newState.players[state.currentPlayer].handCount += action.count; newState.players[state.currentPlayer].deckCount -= action.count; logEntry = createLog(`${player.name} comprou ${action.count} carta(s).`, 'INFO'); break;
    case 'ATTACH_ENERGY':
          if (state.phase !== 'MAIN') { logEntry = createLog(`${player.name} tentou ligar energia fora da fase Principal.`, 'CRITICAL'); break; }
          let targetPoke: PokemonState | null = null;
          if (action.target === 'active') targetPoke = newState.players[state.currentPlayer].active;
          else targetPoke = newState.players[state.currentPlayer].bench[action.index];
          if (targetPoke) {
              targetPoke.energies = [...targetPoke.energies, action.energyType];
              newState.players[state.currentPlayer].energyAttachedThisTurn = true;
              logEntry = createLog(`${player.name} ligou energia ${action.energyType} em ${targetPoke.name}.`);
              playSound('energy', 0.5, 1.0); 
          }
          break;
    
    // --- ADIÇÃO: Lógica de Ferramentas (ATTACH_TOOL) ---
    case 'ATTACH_TOOL':
          const tP = action.target === 'active' ? newState.players[state.currentPlayer].active : newState.players[state.currentPlayer].bench[action.index];
          if (tP) {
              const tool = TOOLS_DATABASE[action.toolName];
              if (tool) {
                  // Regra: Cinto da Bravura e Amuleto só em Básicos
                  if (tool.condition === "BASIC_ONLY" && tP.isEvolved) {
                      logEntry = createLog(`Falha: ${tool.name} só equipa em Básicos.`, 'WARNING');
                  } 
                  else {
                      tP.tool = tool;
                      // APLICAÇÃO REAL DE VIDA:
                      if (tool.effect === 'HP_BOOST') {
                          tP.maxHP += tool.value;
                      }
                      logEntry = createLog(`${player.name} equipou ${tool.name} em ${tP.name} (+${tool.value} HP).`, 'INFO');
                      playSound('click');
                  }
              }
          }
          break;

    case 'PLAY_SUPPORTER':
        if (state.turnNumber === 1 && state.currentPlayer === 'P1') { logEntry = createLog(`${player.name} não pode jogar Apoiador no 1º turno!`, 'CRITICAL'); break; }
        if (state.phase !== 'MAIN' || player.supporterPlayedThisTurn) { logEntry = createLog(`${player.name} já jogou Apoiador.`, 'CRITICAL'); break; }
        newState.players[state.currentPlayer].supporterPlayedThisTurn = true; newState.players[state.currentPlayer].handCount--; logEntry = createLog(`${player.name} jogou Apoiador.`, 'INFO');
        break;
    case 'ADD_DAMAGE':
        const targetPid = action.playerId || (action.attackName ? opponentId : state.currentPlayer);
        const targetP = newState.players[targetPid];
        if (action.attackName) playSound('attack'); else playSound('damage');
        
        // CONFUSÃO
        if (action.attackName && newState.players[state.currentPlayer].active?.condition === 'CONFUSED') {
            const flip = Math.random() > 0.5;
            if (!flip) {
                const selfActive = newState.players[state.currentPlayer].active!;
                selfActive.damage += 30;
                logEntry = createLog(`${player.name} confuso se feriu (30 dano)!`, 'WARNING');
                if (selfActive.damage >= selfActive.maxHP) {
                    const prizeTakerId = state.currentPlayer === 'P1' ? 'P2' : 'P1';
                    const prizesTaken = selfActive.prizeCount;
                    newState.players[prizeTakerId].prizesLeft = Math.max(0, newState.players[prizeTakerId].prizesLeft - prizesTaken);
                    playSound('knockout');
                    newState.players[state.currentPlayer].active = null;
                    if (newState.players[state.currentPlayer].bench.length === 0) { newState.winner = prizeTakerId; logEntry = createLog(`VITÓRIA! Oponente sem banco!`, 'CRITICAL'); }
                    else {
                         if (newState.players[prizeTakerId].prizesLeft === 0) { newState.winner = prizeTakerId; logEntry = createLog(`VITÓRIA!`, 'CRITICAL'); }
                         else { newState.players[state.currentPlayer].mustPromote = true; }
                    }
                }
                newState.phase = 'BETWEEN_TURNS';
                break; 
            }
        }

        // ATAQUE NORMAL
        if (action.attackName) {
             if (state.turnNumber === 1 && state.currentPlayer === 'P1') { logEntry = createLog(`${player.name} não ataca no 1º turno!`, 'CRITICAL'); break; }
             const attacker = newState.players[state.currentPlayer].active;
             
             // PARALISIA E SONO
             if (attacker?.condition === 'PARALYZED') { logEntry = createLog(`${player.name} está paralisado e não pode atacar!`, 'WARNING'); break; }
             if (attacker?.condition === 'ASLEEP') { logEntry = createLog(`${player.name} está dormindo e não pode atacar!`, 'WARNING'); break; }

             if (attacker) {
                 const atkData = attacker.attacks.find((a:any) => a.name === action.attackName);
                 if (atkData && !checkEnergyCost(attacker.energies, atkData.cost)) { logEntry = createLog(`Energia insuficiente para ${action.attackName}.`, 'CRITICAL'); break; }
             }
             if (targetP.active) {
                 targetP.active = { ...targetP.active };
                 targetP.active.damage += action.amount;
                 if (targetP.active.damage >= targetP.active.maxHP) { 
                     const prizesTaken = targetP.active.prizeCount;
                     newState.players[state.currentPlayer].prizesLeft = Math.max(0, newState.players[state.currentPlayer].prizesLeft - prizesTaken);
                      playSound('knockout');
                      targetP.active = null; 
                     if (targetP.bench.length === 0) { newState.winner = state.currentPlayer; logEntry = createLog(`VITÓRIA! Oponente sem banco.`, 'CRITICAL'); targetP.mustPromote = false; } 
                     else {
                         if (newState.players[state.currentPlayer].prizesLeft === 0) { newState.winner = state.currentPlayer; logEntry = createLog(`NOCAUTE e VITÓRIA!`, 'CRITICAL'); targetP.mustPromote = false; } 
                         else { targetP.mustPromote = true; logEntry = createLog(`NOCAUTE! ${player.name} causou ${action.amount} com ${action.attackName}.`, 'CRITICAL'); newState.phase = 'BETWEEN_TURNS'; }
                     }
             } else { logEntry = createLog(`${player.name} usou ${action.attackName} (${action.amount} dano).`, 'INFO'); newState.phase = 'BETWEEN_TURNS'; }
             }
        } else {
            const t2 = action.target === 'active' ? targetP.active : targetP.bench[action.index];
            if (t2) { 
                t2.damage += action.amount; if (t2.damage < 0) t2.damage = 0; 
                if (t2.damage >= t2.maxHP) {
                    const prizes = t2.prizeCount;
                    const prizeTakerId = targetPid === 'P1' ? 'P2' : 'P1';
                    newState.players[prizeTakerId].prizesLeft = Math.max(0, newState.players[prizeTakerId].prizesLeft - prizes);
                    playSound('knockout');
                    if (action.target === 'active') {
                        targetP.active = null;
                        if (targetP.bench.length === 0) { newState.winner = prizeTakerId; logEntry = createLog(`VITÓRIA!`, 'CRITICAL'); } else { targetP.mustPromote = true; }
                    } else { targetP.bench.splice(action.index, 1); }
                    if (!newState.winner && newState.players[prizeTakerId].prizesLeft === 0) { newState.winner = prizeTakerId; logEntry = createLog(`VITÓRIA!`, 'CRITICAL'); } 
                    else if (!newState.winner) { logEntry = createLog(`NOCAUTE NO BANCO!`, 'WARNING'); }
                }
            }
        }
        break;
    case 'PROMOTE_POKEMON':
        const promotionPid = action.playerId || (state.players.P1.mustPromote ? 'P1' : 'P2');
        if (promotionPid) {
            const p = { ...newState.players[promotionPid] };
            p.active = p.bench[action.benchIndex];
            p.bench = p.bench.filter((_, i) => i !== action.benchIndex);
            p.mustPromote = false;
            newState.players[promotionPid] = p;
            logEntry = createLog(`${p.name} promoveu ${p.active!.name}.`, 'INFO');
        }
        break;
    case 'UPDATE_POKEMON':
        const pList = action.target === 'active' ? (newState.players[state.currentPlayer].active ? [newState.players[state.currentPlayer].active] : []) : newState.players[state.currentPlayer].bench;
        if (action.target === 'bench' && typeof action.index === 'number' && action.index >= pList.length) {
            newState.players[state.currentPlayer].bench.push(initialPokemon(`p-${Date.now()}`, action.newName));
            // CORREÇÃO: Log para adição no banco
            logEntry = createLog(`${player.name} colocou ${action.newName} no Banco.`, 'INFO');
        } else {
            const t = action.target === 'active' ? newState.players[state.currentPlayer].active : newState.players[state.currentPlayer].bench[action.index];
            if (t) { 
                // CORREÇÃO: Log para atualização de Pokémon
                logEntry = createLog(`${player.name} alterou o Pokémon para ${action.newName}.`, 'INFO');
                const newData = initialPokemon(t.id, action.newName); 
                t.name = newData.name; 
                t.maxHP = newData.maxHP; 
                t.type = newData.type; 
                t.attacks = newData.attacks; 
                t.weakness = newData.weakness; 
                t.resistance = newData.resistance; 
                t.retreatCost = newData.retreatCost; 
                t.evolvesTo = newData.evolvesTo; 
                t.hasDetailsLoaded = newData.hasDetailsLoaded; 
                t.prizeCount = newData.prizeCount; 
            }
        }
        break;
    case 'EVOLVE_POKEMON':
        const evoT = action.target === 'active' ? newState.players[state.currentPlayer].active : newState.players[state.currentPlayer].bench[action.index];
        if (evoT && evoT.turnsInPlay > 0 && !(state.turnNumber === 1 && state.currentPlayer === 'P1')) {
            const evolved = initialPokemon(evoT.id, action.evolutionName);
            evolved.damage = evoT.damage; evolved.energies = evoT.energies; evolved.isEvolved = true;
            // Mantém ferramenta se tiver e adiciona HP extra se for ferramenta generica (ou remove se for BASIC_ONLY)
            if (evoT.tool) {
                if (evoT.tool.condition === 'BASIC_ONLY') {
                    // Perde o bônus ao evoluir
                    evolved.tool = null;
                } else {
                    evolved.tool = evoT.tool;
                    if (evolved.tool.effect === 'HP_BOOST') evolved.maxHP += evolved.tool.value;
                }
            }
            if (action.target === 'active') newState.players[state.currentPlayer].active = evolved; else newState.players[state.currentPlayer].bench[action.index] = evolved;
            logEntry = createLog(`${player.name} evoluiu ${evoT.name} para ${action.evolutionName}.`, 'INFO');
        } else { logEntry = createLog("Evolução inválida: Turno de espera necessário.", 'WARNING'); }
        break;
    case 'SET_CONDITION':
        const condPid = action.playerId || state.currentPlayer;
        const condPState = newState.players[condPid as PlayerId];
        let condTarget = null;
        if (action.target === 'active') condTarget = condPState.active;
        else if (action.target === 'bench' && typeof action.index === 'number') condTarget = condPState.bench[action.index];
        if (condTarget) {
            if (condTarget.condition === action.condition) { condTarget.condition = 'NONE'; logEntry = createLog(`${condPState.name} curou ${condTarget.name}.`, 'INFO'); } 
            else { condTarget.condition = action.condition; logEntry = createLog(`${condPState.name} definiu ${condTarget.name} como ${action.condition}.`, 'INFO'); }
        }
        break;
    case 'PAY_RETREAT_MANUAL':
         const activeP = newState.players[state.currentPlayer].active;
         if (activeP) {
             const sortedIndices = action.energyIndices.sort((a: number, b: number) => b - a);
             sortedIndices.forEach((idx: number) => { activeP.energies.splice(idx, 1); });
             logEntry = createLog(`${player.name} recuou (custo pago).`, 'INFO');
         }
         break;
    case 'SWAP_ACTIVE_BENCH':
         const sPlayer = newState.players[state.currentPlayer];
         if (sPlayer.active && sPlayer.bench[action.benchIndex]) {
             if (sPlayer.active.condition === 'PARALYZED' || sPlayer.active.condition === 'ASLEEP') {
                 logEntry = createLog(`${player.name} não pode recuar (Status).`, 'WARNING');
             } else {
                 const oldActive = sPlayer.active; oldActive.condition = 'NONE'; oldActive.turnsInPlay = 0; 
                 const newActive = sPlayer.bench[action.benchIndex];
                 sPlayer.active = newActive; sPlayer.bench[action.benchIndex] = oldActive;
                 sPlayer.retreatedThisTurn = true; 
                 logEntry = createLog(`${player.name} trocou para ${newActive.name}.`, 'INFO');
             }
         }
         break;
    case 'USE_ABILITY': logEntry = createLog(`${player.name} usou Habilidade: ${action.abilityName}.`, 'INFO'); break;
    case 'COIN_FLIP': logEntry = createLog(`${player.name} jogou moeda: ${action.result}`, 'INFO'); break;
  }
  if (newEvents.length > 0) newState.events = [...newEvents, ...newState.events];
  if (logEntry) newState.events = [logEntry, ...newState.events];
  return newState;
}

// --- COMPONENTES VISUAIS ---

// Nova Interface para o Histórico
interface MatchHistoryRecord {
    id: string;
    date: string;
    p1Name: string;
    p1Deck: string;
    p2Name: string;
    p2Deck: string;
    winner: string;
    events: GameEvent[];
}

const HistoryModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
    const [history, setHistory] = useState<MatchHistoryRecord[]>([]);
    const [selectedMatch, setSelectedMatch] = useState<MatchHistoryRecord | null>(null);

    useEffect(() => {
        if (isOpen) {
            const saved = localStorage.getItem('judgeTech_match_history');
            if (saved) setHistory(JSON.parse(saved));
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] flex flex-col">
                <div className="flex justify-between items-center mb-6 border-b border-slate-700 pb-4">
                    <h3 className="text-2xl font-bold text-white flex items-center gap-2"><History className="text-blue-400" /> Histórico de Partidas</h3>
                    <button onClick={onClose}><XCircle className="text-slate-500 hover:text-white" /></button>
                </div>
                
                <div className="flex gap-4 flex-1 overflow-hidden">
                    {/* Lista de Partidas */}
                    <div className={`${selectedMatch ? 'w-1/3 hidden md:block' : 'w-full'} overflow-y-auto custom-scrollbar space-y-3`}>
                        {history.length === 0 ? <p className="text-slate-500 text-center">Nenhuma partida salva.</p> : 
                            history.map((match) => (
                                <div key={match.id} onClick={() => setSelectedMatch(match)} className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedMatch?.id === match.id ? 'bg-slate-800 border-blue-500' : 'bg-slate-900 border-slate-700 hover:bg-slate-800'}`}>
                                    <div className="flex justify-between text-xs text-slate-500 mb-2"><span>{match.date}</span></div>
                                    <div className="flex justify-between items-center">
                                        <div className="text-sm font-bold text-white">{match.winner} venceu!</div>
                                        <ChevronRight size={16} className="text-slate-500"/>
                                    </div>
                                    <div className="mt-2 text-xs text-slate-400">
                                        {match.p1Name} ({match.p1Deck}) vs {match.p2Name} ({match.p2Deck})
                                    </div>
                                </div>
                            ))
                        }
                    </div>

                    {/* Detalhes do Log */}
                    {selectedMatch && (
                        <div className="flex-1 bg-slate-950 rounded-xl border border-slate-800 p-4 flex flex-col">
                            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800">
                                <h4 className="font-bold text-white">Log da Partida</h4>
                                <button onClick={() => setSelectedMatch(null)} className="md:hidden text-slate-400">Voltar</button>
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1">
                                {selectedMatch.events.map((evt) => <TimelineItem key={evt.id} evt={evt} />)}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const DamageConfirmModal = ({ attack, attacker, defender, prizesDiff, onConfirm, onCancel }: any) => {
    const getBaseCalculated = () => {
        let val = parseInt(attack.damage) || 0;
        // Fraqueza (x2)
        if (defender.weakness === attacker.type) val *= 2;
        // Resistência (-30)
        if (defender.resistance === attacker.type) val -= 30;
        
        // FERRAMENTAS LÓGICAS:
        if (attacker.tool) {
            // Maximum Belt: +50 em ex
            if (attacker.tool.condition === "VS_EX" && (defender.name.toLowerCase().includes("ex") || defender.name.toLowerCase().includes("v"))) {
                val += attacker.tool.value;
            }
            // Defiance Band: +30 se estiver perdendo em prêmios
            if (attacker.tool.condition === "BEHIND_PRIZES" && prizesDiff > 0) {
                val += attacker.tool.value;
            }
            // Choice Belt (Genérico V)
            if (attacker.tool.condition === "VS_V_EX" && (defender.name.toLowerCase().includes("v") || defender.name.toLowerCase().includes("ex"))) {
                val += attacker.tool.value;
            }
        }
        return Math.max(0, val);
    };

    const [dmg, setDmg] = useState(getBaseCalculated());
    const [flipRes, setFlipRes] = useState<string | null>(null);

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl border-4 border-red-500 animate-in zoom-in-95">
                <h3 className="text-xl font-bold text-slate-800 text-center mb-1">Confirmar Dano Principal</h3>
                <p className="text-slate-400 text-center mb-6 text-sm italic">{attack.name}</p>
                <div className="flex items-center justify-center gap-6 mb-8">
                    <button onClick={() => { setDmg(prev => Math.max(0, prev - 10)); playSound('click'); }} className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-3xl text-slate-400 hover:bg-slate-200 transition-all">−</button>
                    <span className="text-6xl font-black text-red-600 tabular-nums">{dmg}</span>
                    <button onClick={() => { setDmg(prev => prev + 10); playSound('click'); }} className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-3xl text-slate-400 hover:bg-slate-200 transition-all">+</button>
                </div>
                <div className="flex flex-col items-center mb-8 gap-2">
                    <button onClick={() => { playSound('coin'); setFlipRes(Math.random() > 0.5 ? 'CARA' : 'COROA'); }} className="bg-yellow-400 text-black px-4 py-1.5 rounded-full font-bold text-[10px] uppercase tracking-wider shadow-md flex items-center gap-2"><Coins size={14}/> Jogue a Moeda</button>
                    {flipRes && <span className={`text-xl font-black ${flipRes === 'CARA' ? 'text-green-600' : 'text-red-500'}`}>{flipRes}</span>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <button onClick={onCancel} className="py-3 bg-slate-700 hover:bg-slate-800 text-white rounded-xl font-bold uppercase text-xs tracking-widest transition-all">Cancelar</button>
                    <button onClick={() => onConfirm(dmg)} className="py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold uppercase text-xs tracking-widest shadow-lg shadow-red-200 transition-all">Confirmar</button>
                </div>
            </div>
        </div>
    );
};

const EnergyBadge = ({ type, size = 'sm' }: { type: EnergyType, size?: 'sm'|'md'|'lg' }) => {
    const config = ENERGY_CONFIG[type] || ENERGY_CONFIG.COLORLESS;
    const Icon = config.icon;
    let dim = 'w-4 h-4 text-[10px]';
    if (size === 'md') dim = 'w-6 h-6 text-xs';
    if (size === 'lg') dim = 'w-8 h-8 text-sm';
    return <div className={`${dim} rounded-full flex items-center justify-center text-white shadow-sm border border-white/20 ${config.bg}`} title={config.label}><Icon size={size === 'sm' ? 10 : size === 'md' ? 14 : 18} strokeWidth={3} /></div>;
};

const PromotionModal = ({ player, onPromote, onForceRestart }: { player: PlayerState, onPromote: (index: number) => void, onForceRestart: () => void }) => {
    const hasBench = player.bench.length > 0;
    return (
        <div className="fixed inset-0 bg-black/95 z-[60] flex flex-col items-center justify-center p-8 animate-in fade-in">
             <h2 className="text-3xl text-white font-bold mb-8 flex items-center gap-3"><AlertTriangle className="text-red-500" size={32}/> {player.name}: Seu Ativo foi Nocauteado!</h2>
             <p className="text-slate-400 mb-8">{hasBench ? "Escolha um novo Pokémon Ativo do seu banco para continuar." : "Você não tem Pokémon no banco."}</p>
             {!hasBench ? (
                 <div className="flex flex-col items-center gap-6"><div className="text-red-500 text-2xl font-bold border-2 border-red-500 p-6 rounded-xl bg-red-900/20">SEM POKÉMON NO BANCO - FIM DE JOGO</div><button onClick={onForceRestart} className="bg-white text-black px-8 py-3 rounded-full font-bold hover:scale-105 transition-all">Finalizar e Reiniciar</button></div>
             ) : (
                 <div className="flex gap-6 flex-wrap justify-center">{player.bench.map((poke, i) => { const typeConfig = ENERGY_CONFIG[poke.type] || ENERGY_CONFIG.COLORLESS; return (<div key={i} onClick={() => onPromote(i)} className="cursor-pointer group transform hover:scale-105 transition-all"><div className={`w-40 h-56 rounded-xl border-4 border-green-500 bg-slate-200 flex flex-col relative shadow-[0_0_30px_rgba(34,197,94,0.4)] overflow-hidden`}><div className="bg-slate-300 p-2 border-b border-slate-400 flex justify-between items-center"><span className="font-bold text-xs truncate">{poke.name}</span><span className="text-xs font-black text-red-600">{poke.maxHP}</span></div><div className={`flex-1 ${typeConfig.bg} flex items-center justify-center relative`}>{typeConfig.icon && <typeConfig.icon size={64} className="text-white/30" />}<div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-green-900/60 transition-opacity"><div className="flex flex-col items-center text-white"><ArrowUpCircle size={40} className="mb-2"/><span className="font-bold uppercase text-sm">Promover</span></div></div></div></div></div>); })}</div>
             )}
        </div>
    )
}

const WinnerModal = ({ winnerName, onRestart }: { winnerName: string, onRestart: () => void }) => (
    <div className="fixed inset-0 bg-black/95 z-[70] flex flex-col items-center justify-center p-8 animate-in zoom-in">
            <Trophy className="text-yellow-400 mb-6" size={80}/>
            <h1 className="text-6xl text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 font-black mb-4">VENCEDOR!</h1>
            <p className="text-2xl text-white font-bold mb-8">{winnerName} venceu a partida.</p>
            <button onClick={onRestart} className="bg-white text-black px-8 py-4 rounded-full font-bold text-xl hover:scale-110 transition-transform shadow-lg flex items-center gap-2"><RestartIcon/> Jogar Novamente</button>
    </div>
);

const RankingModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
    const [stats, setStats] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'decks' | 'players'>('decks');

    // Busca dados iniciais
    const fetchRanking = async () => {
        const { data } = await supabase.from('ranking').select('*');
        if (data) setStats(data);
    };

    useEffect(() => {
        if (isOpen) {
            fetchRanking();

            // INSCRIÇÃO EM TEMPO REAL (Magia do Supabase)
            const channel = supabase
                .channel('ranking_updates')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'ranking' }, (payload) => {
                    fetchRanking(); // Recarrega se alguém ganhar uma partida em outro lugar
                })
                .subscribe();

            return () => { supabase.removeChannel(channel); };
        }
    }, [isOpen]);

    // Processa os dados brutos para separar por Deck ou Player
    const getProcessedStats = () => {
        if (activeTab === 'decks') {
            // Agrupa por nome do deck
            const deckMap: Record<string, { wins: number, matches: number }> = {};
            stats.forEach(row => {
                if (!deckMap[row.deck_name]) deckMap[row.deck_name] = { wins: 0, matches: 0 };
                deckMap[row.deck_name].wins += row.wins;
                deckMap[row.deck_name].matches += row.matches;
            });
            return Object.entries(deckMap).map(([name, val]) => ({ name, ...val }));
        } else {
            // Agrupa por nome do jogador
            const playerMap: Record<string, { wins: number, matches: number }> = {};
            stats.forEach(row => {
                if (!playerMap[row.player_name]) playerMap[row.player_name] = { wins: 0, matches: 0 };
                playerMap[row.player_name].wins += row.wins;
                playerMap[row.player_name].matches += row.matches;
            });
            return Object.entries(playerMap).map(([name, val]) => ({ name, ...val }));
        }
    };

    const displayData = getProcessedStats().sort((a, b) => (b.wins / (b.matches || 1)) - (a.wins / (a.matches || 1)));

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-slate-900 border border-yellow-500/50 p-6 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
                <div className="flex justify-between items-center mb-6 border-b border-slate-700 pb-4">
                    <h3 className="text-2xl font-bold text-white flex items-center gap-2"><Trophy className="text-yellow-400" /> Ranking Global (Online)</h3>
                    <button onClick={onClose}><XCircle className="text-slate-500 hover:text-white" /></button>
                </div>
                <div className="flex gap-2 mb-4">
                    <button onClick={() => setActiveTab('decks')} className={`px-4 py-2 rounded-lg font-bold transition-colors ${activeTab === 'decks' ? 'bg-yellow-500 text-black' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>Decks</button>
                    <button onClick={() => setActiveTab('players')} className={`px-4 py-2 rounded-lg font-bold transition-colors ${activeTab === 'players' ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>Jogadores</button>
                </div>
                <div className="overflow-hidden rounded-lg border border-slate-700 overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left text-sm text-slate-300">
                        <thead className="bg-slate-800 text-xs uppercase text-slate-400 font-bold"><tr><th className="px-4 py-3">Nome</th><th className="px-4 py-3 text-center">Partidas</th><th className="px-4 py-3 text-center">Vitórias</th><th className="px-4 py-3 text-right">Winrate</th></tr></thead>
                        <tbody className="divide-y divide-slate-700">
                            {displayData.map((stat) => (
                                <tr key={stat.name} className="hover:bg-slate-800/50 transition-colors">
                                    <td className="px-4 py-3 font-bold text-white">{stat.name}</td>
                                    <td className="px-4 py-3 text-center">{stat.matches}</td>
                                    <td className="px-4 py-3 text-center text-green-400">{stat.wins}</td>
                                    <td className="px-4 py-3 text-right font-mono font-bold text-yellow-500">{stat.matches > 0 ? ((stat.wins / stat.matches) * 100).toFixed(1) : 0}%</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const EnergyDiscardModal = ({ energies, cost, onConfirm, onCancel }: { energies: EnergyType[], cost: number, onConfirm: (indices: number[]) => void, onCancel: () => void }) => {
    const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
    const toggleSelection = (index: number) => { if (selectedIndices.includes(index)) { setSelectedIndices(selectedIndices.filter(i => i !== index)); } else { if (cost > 0 && selectedIndices.length < cost) { setSelectedIndices([...selectedIndices, index]); } } };
    const isValid = selectedIndices.length === Math.min(cost, energies.length);
    return (
        <div className="fixed inset-0 bg-black/90 z-[70] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md shadow-2xl">
                <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2"><Trash2 className="text-red-500"/> Descartar para Recuar</h3>
                <p className="text-slate-400 mb-6 text-sm">Custo: <span className="text-white font-bold">{cost}</span>. Selecione energias.</p>
                <div className="flex flex-wrap gap-3 justify-center mb-8 bg-slate-800 p-4 rounded-lg">{energies.map((type, i) => (<div key={i} onClick={() => toggleSelection(i)} className={`cursor-pointer transform transition-all relative ${selectedIndices.includes(i) ? 'scale-110 ring-2 ring-red-500 rounded-full z-10' : 'opacity-70 hover:opacity-100 hover:scale-105'}`}><EnergyBadge type={type} size="lg" />{selectedIndices.includes(i) && (<div className="absolute -top-1 -right-1 bg-red-600 rounded-full p-0.5 border border-slate-900"><X size={10} className="text-white"/></div>)}</div>))}</div>
                <div className="flex gap-3"><button onClick={onCancel} className="flex-1 py-3 bg-slate-800 text-slate-300 rounded-lg font-bold hover:bg-slate-700">Cancelar</button><button onClick={() => onConfirm(selectedIndices)} disabled={!isValid} className="flex-1 py-3 bg-red-600 text-white rounded-lg font-bold hover:bg-red-500 disabled:opacity-50">Descartar</button></div>
            </div>
        </div>
    );
};

const AIModal = ({ isOpen, onClose, events, activePlayerName, gameState }: { isOpen: boolean, onClose: () => void, events: GameEvent[], activePlayerName: string, gameState: GameState }) => {
    const [query, setQuery] = useState('');
    const [result, setResult] = useState('');
    const [loading, setLoading] = useState(false);
    const handleCallGemini = async (customPrompt: string, isSummary: boolean = false) => {
        setLoading(true); setResult('');
        try {
            let finalPrompt = customPrompt;
            if (isSummary) { const logs = JSON.stringify(events.slice(0, 30)); finalPrompt = `Resumo Pokémon TCG. Jogador Ativo: ${activePlayerName}. Logs: ${logs}`; }
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: finalPrompt }] }], systemInstruction: { parts: [{ text: "Juiz Pokémon TCG Especialista." }] } })
            });
            const data = await response.json();
            setResult(data.candidates?.[0]?.content?.parts?.[0]?.text || "Erro.");
        } catch (error) { setResult("Erro conexão."); } finally { setLoading(false); }
    };
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-slate-900 border border-indigo-500/50 p-6 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
               <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-4"><h3 className="text-xl font-bold text-white flex items-center gap-2"><Sparkles className="text-indigo-400" /> Juiz IA</h3><button onClick={onClose}><XCircle className="text-slate-500 hover:text-white" /></button></div>
                <div className="flex-1 overflow-y-auto mb-4 custom-scrollbar min-h-[200px]">{loading ? <div className="text-indigo-300 text-center mt-10 animate-pulse">Consultando...</div> : result ? <div className="bg-slate-800 p-4 rounded text-slate-200">{result}</div> : <div className="text-center text-slate-500 mt-10">Pergunte sobre regras.</div>}</div>
                <div className="flex gap-2 pt-4 border-t border-slate-700"><input type="text" className="flex-1 bg-slate-950 border-slate-700 rounded p-3 text-white" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Regra..." /><button onClick={() => handleCallGemini(query)} className="bg-indigo-600 text-white px-4 rounded font-bold"><Send size={18}/></button></div>
            </div>
        </div>
    );
};

const TimelineItem = ({ evt }: any) => (
    <div className={`p-2.5 mb-2 rounded border-l-2 text-xs transition-all animate-in fade-in slide-in-from-left-2 ${evt.severity === 'CRITICAL' ? 'bg-red-900/10 border-red-500' : evt.severity === 'WARNING' ? 'bg-yellow-900/10 border-yellow-500' : 'bg-slate-800 border-slate-600'}`}>
      <div className="flex justify-between items-start mb-0.5"><span className={`font-bold ${evt.playerId === 'P1' ? 'text-blue-400' : 'text-red-400'}`}>{evt.playerName}</span><span className="text-[10px] text-slate-500 font-mono">{evt.timestamp}</span></div><div className="text-slate-300 leading-tight">{evt.description}</div>
    </div>
);

const CardDetailsModal = ({ pokemon, deckTheme, onClose, onUseAttack, onSetCondition, onAddDamage, onEvolve, onUseAbility }: any) => {
  const typeConfig = ENERGY_CONFIG[pokemon.type] || ENERGY_CONFIG.COLORLESS;
  const [extraDamage, setExtraDamage] = useState(0);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in zoom-in-95" onClick={onClose}>
      <div className="bg-slate-200 rounded-xl shadow-2xl w-11/12 max-w-6xl h-5/6 overflow-hidden flex flex-col relative border-8 border-yellow-400 max-h-[95vh]" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-red-500 bg-white/80 rounded-full p-2 z-50 shadow-lg border border-slate-300"><X size={32}/></button>
        <div className="bg-slate-100 p-6 flex justify-between items-center border-b border-slate-300">
          <div className="flex flex-col"><span className="text-lg font-bold text-slate-500 uppercase tracking-wider">{pokemon.isEvolved ? "Evolução" : "Básico"}</span><h2 className="text-4xl font-bold text-slate-800 leading-none">{pokemon.name}</h2></div>
          <div className="flex items-center gap-4 mr-16"><span className="text-red-600 font-bold text-2xl">PS</span><span className="text-5xl font-black text-slate-900">{pokemon.maxHP}</span><EnergyBadge type={pokemon.type} size="lg" /></div>
        </div>
        <div className="flex flex-1 overflow-hidden">
          <div className={`w-[35%] ${typeConfig.bg} relative flex flex-col items-center justify-center border-r-4 border-yellow-500 shadow-inner`}>
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-black/20" />
            <div className="z-10 flex flex-col items-center mb-8"><span className="text-white font-bold text-sm uppercase tracking-widest drop-shadow-md">Dano Atual</span><span className="text-7xl font-black text-white drop-shadow-xl">{pokemon.damage}</span></div>
            <div className="flex gap-6 z-20 mb-8">
              <button onClick={() => { onAddDamage(-10); playSound('click'); }} className="w-16 h-16 bg-white/20 hover:bg-white/40 rounded-full text-white font-bold flex items-center justify-center backdrop-blur text-3xl border-4 border-white/50">-</button>
              <button onClick={() => { onAddDamage(10); playSound('damage'); }} className="w-16 h-16 bg-white/20 hover:bg-white/40 rounded-full text-white font-bold flex items-center justify-center backdrop-blur text-3xl border-4 border-white/50">+</button>
            </div>
            <div className="flex gap-2 flex-wrap justify-center px-4 z-20">
              {['POISONED', 'BURNED', 'ASLEEP', 'PARALYZED', 'CONFUSED'].map((cond) => { 
                const map: any = { 'POISONED': 'VEN', 'BURNED': 'QUE', 'ASLEEP': 'DOR', 'PARALYZED': 'PAR', 'CONFUSED': 'CON' }; 
                const isActive = pokemon.condition === cond; 
                return <button key={cond} onClick={() => { onSetCondition(cond as SpecialCondition); playSound('click'); }} className={`text-xs font-bold px-3 py-1.5 rounded-full border ${isActive ? 'bg-purple-600 text-white' : 'bg-black/30 text-white/70'}`}>{map[cond]}</button>; 
              })}
            </div>
            <div className="absolute bottom-4 left-4 z-20 bg-black/40 px-3 py-1 rounded text-white text-xs font-bold border border-white/30">Vale {pokemon.prizeCount} Prêmio(s)</div>
          </div>
          <div className="flex-1 bg-slate-100 flex flex-col overflow-y-auto p-8">
            {pokemon.evolvesTo && (<div className="mb-6"><h4 className="text-sm font-bold text-slate-500 uppercase mb-2">Evolução</h4>{pokemon.evolvesTo.map((evo: string) => <button key={evo} onClick={() => { onEvolve(evo); playSound('energy'); }} className="bg-green-600 text-white px-4 py-2 rounded font-bold shadow flex items-center gap-2"><ArrowUpCircle size={18}/> Evoluir para {evo}</button>)}</div>)}
            
            {/* SEÇÃO DE FERRAMENTAS ADICIONADA */}
            <div className="mb-6 border-b border-slate-300 pb-4">
                <h4 className="text-sm font-bold text-slate-500 uppercase mb-2">Ferramenta</h4>
                {pokemon.tool ? (
                    <div className="flex items-center gap-3 bg-blue-100 p-3 rounded-lg border border-blue-300">
                        <Briefcase className="text-blue-600"/>
                        <div><p className="font-bold text-blue-900">{pokemon.tool.name}</p><p className="text-xs text-blue-700">{pokemon.tool.text}</p></div>
                    </div>
                ) : (
                    <div className="flex gap-2 flex-wrap">
                        {Object.keys(TOOLS_DATABASE).map(tName => (
                            <button key={tName} onClick={() => onUseAttack({name: "ATTACH_TOOL_ACTION"}, null, tName)} className="text-xs bg-slate-200 hover:bg-slate-300 px-3 py-1 rounded border border-slate-400 text-slate-700 font-bold">+ {tName}</button>
                        ))}
                    </div>
                )}
            </div>

            <div className="space-y-8">
              {pokemon.abilities && pokemon.abilities.map((ab: Ability, i: number) => (
                <div key={i} className="border-b-2 border-red-800/10 pb-6 relative group">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3"><span className="text-red-700 font-bold text-sm uppercase bg-red-100 px-3 py-1 rounded">Habilidade</span><h4 className="font-bold text-2xl text-red-900">{ab.name}</h4></div>
                    {/* BOTÃO DE USAR HABILIDADE REINTEGRADO */}
                    <button onClick={() => { onUseAbility(ab.name); playSound('energy'); }} className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded shadow-sm flex items-center gap-1 transition-transform active:scale-95"><PlayCircle size={14}/> Usar</button>
                  </div>
                  <p className="text-lg text-slate-700 italic">{ab.text}</p>
                </div>
              ))}
              {pokemon.attacks.map((atk: any, i: number) => {
                const baseDmg = parseInt(atk.damage) || 0;
                const finalDmg = baseDmg + extraDamage;
                return (
                  <div key={i} className="border-b border-slate-300 pb-6 group">
                    <div className="flex items-center gap-4 mb-3">
                      <div className="flex gap-1.5">{atk.cost.map((c: any, j: number) => <EnergyBadge key={j} type={c} size="lg"/>)}</div>
                      <h4 className="font-bold text-3xl text-slate-800">{atk.name}</h4>
                      
                      <div className="ml-auto flex items-center gap-2 bg-slate-300 p-1.5 rounded-xl border border-slate-400">
                        <button onClick={() => { setExtraDamage(prev => prev - 10); playSound('click'); }} className="w-8 h-8 bg-white rounded-lg font-black text-red-600 shadow-sm">-10</button>
                        <div className="flex flex-col items-center min-w-[50px]">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Dano</span>
                          <span className="font-bold text-4xl text-slate-900 leading-none">{finalDmg}</span>
                        </div>
                        <button onClick={() => { setExtraDamage(prev => prev + 10); playSound('click'); }} className="w-8 h-8 bg-white rounded-lg font-black text-green-600 shadow-sm">+10</button>
                        <div className="w-[1px] h-8 bg-slate-400 mx-1"></div>
                        <button onClick={() => { setExtraDamage(baseDmg); playSound('coin'); }} className="px-2 h-8 bg-orange-500 text-white rounded-lg text-[10px] font-black shadow-sm">x2</button>
                        <button onClick={() => { setExtraDamage(prev => prev - 30); playSound('click'); }} className="px-2 h-8 bg-blue-500 text-white rounded-lg text-[10px] font-black shadow-sm">-30</button>
                      </div>
                    </div>
                    <p className="text-xl text-slate-700 mb-4">{atk.text}</p>
                    {/* Botão de Ataque que chama a lógica do Modal de Confirmação */}
                    <button onClick={() => onUseAttack(atk, pokemon)} className="w-full bg-red-600 hover:bg-red-700 text-white text-lg font-bold px-6 py-4 rounded-xl shadow-lg flex items-center justify-center gap-3 active:scale-95 transition-all">
                      <Swords size={20}/> LANÇAR ATAQUE ({finalDmg})
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const CardSlot = ({ pokemon, theme, isOpponent, isActive, interactionMode, onInteract, onOpenSelector, onOpenDetails }: any) => {
  const widthClass = isActive ? 'w-36 md:w-48' : 'w-24 md:w-32';
  const heightClass = isActive ? 'h-48 md:h-64' : 'h-32 md:h-48';
  
  if (!pokemon && isActive) return ( <div onClick={() => { onInteract(); playSound('click'); }} className={`relative rounded-md flex flex-col items-center justify-center border-2 border-dashed border-slate-600 bg-slate-900/50 text-slate-500 ${widthClass} ${heightClass} ${interactionMode === 'PROMOTE' ? 'cursor-pointer animate-pulse border-yellow-400 text-yellow-400' : ''}`}><div className="text-[10px] font-bold text-center p-2">CAMPO ATIVO VAZIO</div></div> );
  if (!pokemon) return ( <button onClick={() => { onOpenSelector(); playSound('click'); }} disabled={isOpponent} className={`${widthClass} ${heightClass} border border-dashed border-slate-700 rounded-md bg-slate-900/30 flex items-center justify-center hover:bg-slate-800/50 text-slate-700 text-2xl md:text-4xl`}>+</button> );

  const typeConfig = ENERGY_CONFIG[pokemon.type] || ENERGY_CONFIG.COLORLESS;
  const hpLeft = Math.max(0, pokemon.maxHP - pokemon.damage);
  
  let interactionOverlay = null;
  if (interactionMode === 'ATTACH_ENERGY' && !isOpponent) interactionOverlay = <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-30 animate-pulse"><Zap className="text-yellow-400" size={32}/></div>;
  else if (interactionMode === 'DISTRIBUTE_DAMAGE' && isOpponent) interactionOverlay = <div className="absolute inset-0 flex items-center justify-center bg-red-900/40 z-30 animate-pulse border-4 border-red-500"><Target className="text-white" size={40}/></div>;
  else if ((interactionMode === 'PROMOTE' || interactionMode === 'RETREAT_SELECT_NEW_ACTIVE') && !isOpponent && !isActive) interactionOverlay = <div className="absolute inset-0 flex items-center justify-center bg-green-900/60 z-30 animate-pulse border-4 border-green-500"><ArrowUpCircle size={40} className="text-white mb-2"/></div>;
  else if (interactionMode === 'RETREAT_PAY_COST' && isActive && !isOpponent) interactionOverlay = <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-30 animate-pulse border-4 border-red-500"><div className="bg-red-600 text-white font-bold p-2 rounded text-xs">PAGAR RECUO</div></div>;

  let contentOverlay = null;
  if (pokemon.abilities && pokemon.abilities.length > 0) contentOverlay = <div className="z-10 bg-red-50/90 rounded-md px-1 py-0.5 md:px-2 md:py-1 mt-auto mb-1 w-full text-center shadow-sm border border-red-200"><div className="text-[6px] md:text-[8px] font-bold text-red-600 uppercase tracking-wider mb-0.5">Habilidade</div><div className="text-[8px] md:text-[10px] font-bold text-red-900 truncate leading-tight">{pokemon.abilities[0].name}</div></div>;
  else if (pokemon.attacks.length > 0) contentOverlay = <div className="z-10 bg-white/90 rounded-md px-1 py-0.5 md:px-2 md:py-1 mt-auto mb-1 w-full text-center shadow-sm"><div className="text-[8px] md:text-[10px] font-bold text-slate-800 truncate">{pokemon.attacks[0].name}</div><div className="text-[10px] md:text-xs font-black text-slate-600">{pokemon.attacks[0].damage}</div></div>;

  return (
    <div className={`relative rounded-lg flex flex-col overflow-hidden transition-all shadow-md ${widthClass} ${heightClass} ${isActive ? 'ring-4 ring-offset-2 ring-offset-slate-800' : ''} border-4 border-yellow-400 bg-slate-200 group cursor-pointer`} onClick={(e) => { e.stopPropagation(); playSound('click'); if (interactionMode !== 'NONE') onInteract(); else onOpenDetails(); }}>
      {interactionOverlay}
      <div className="bg-slate-300 p-1 md:p-1.5 flex justify-between items-center border-b border-slate-400/50 h-8 md:h-10 shrink-0">
          <span className="text-[10px] md:text-xs font-bold text-slate-800 truncate w-16 md:w-20">{pokemon.name}</span>
          <span className="text-[8px] md:text-[9px] font-bold text-slate-600">{hpLeft}/{pokemon.maxHP}</span>
      </div>
      <div className={`flex-1 ${typeConfig.bg} relative flex flex-col items-center justify-center overflow-hidden p-1 md:p-2`}>
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-black/10"></div>
        {typeConfig.icon && <typeConfig.icon size={isActive ? 60 : 30} className="text-white/20 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />}
        {contentOverlay}
        
        {/* ÍCONE DE FERRAMENTA ADICIONADO */}
        {pokemon.tool && <div className="absolute top-1 left-1 md:top-2 md:left-2 z-20"><div className="bg-blue-600 rounded-full w-5 h-5 md:w-6 md:h-6 flex items-center justify-center shadow-md border border-white" title={pokemon.tool.name}><Briefcase size={10} className="text-white"/></div></div>}
        
        {pokemon.damage > 0 && <div className="absolute top-1 right-1 md:top-2 md:right-2 z-20"><div className="bg-white/95 rounded-full w-8 h-8 md:w-10 md:h-10 flex items-center justify-center shadow-lg border-2 border-red-500"><span className="text-red-600 font-black text-xs md:text-sm">{pokemon.damage}</span></div></div>}
      </div>
      <div className="bg-slate-100 h-8 md:h-10 shrink-0 border-t border-slate-300 flex items-center justify-center px-1 overflow-hidden"><div className="flex gap-0.5 flex-wrap justify-center">{pokemon.energies.map((t:any, i:any) => <EnergyBadge key={i} type={t} size="sm"/>)}</div></div>
      {pokemon.condition !== 'NONE' && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-purple-600 text-white text-[8px] md:text-xs px-2 py-0.5 md:px-3 md:py-1 rounded-full shadow-md z-20 rotate-12">{pokemon.condition}</div>}
    </div>
  );
};

const PlayerPanel = ({ player, isCurrentTurn, isOpponent, interactionMode, onCardClick, onOpenSelector, onOpenDetails }: any) => {
  const bgGradient = player.deckTheme ? `bg-gradient-to-r ${player.deckTheme.gradient}` : 'bg-slate-800';
  return (
    <div className={`flex flex-col ${isOpponent ? 'justify-end pb-2 md:pb-4' : 'justify-start pt-2 md:pt-4'} h-full relative`}>
      <div className={`absolute inset-x-0 ${isOpponent ? 'top-0 h-2' : 'bottom-0 h-2'} ${bgGradient} opacity-50`}></div>
      <div className={`flex gap-2 md:gap-3 overflow-x-auto no-scrollbar px-4 ${isOpponent ? 'order-1 opacity-80 scale-90 origin-bottom' : 'order-2 mt-2 md:mt-4'} ${isOpponent ? 'items-end' : 'items-start'}`}>
        {player.bench.map((poke: any, i: number) => (
            <div key={poke.id} className="shrink-0">
                <CardSlot key={poke.id} pokemon={poke} theme={player.deckTheme} isOpponent={isOpponent} isActive={false} interactionMode={interactionMode} onInteract={() => onCardClick('bench', i, player.id)} onOpenSelector={() => onOpenSelector('bench', i)} onOpenDetails={() => onOpenDetails('bench', i, player.id)} />
            </div>
        ))}
        {!isOpponent && player.bench.length < 5 && (
            <div onClick={() => { onOpenSelector('bench', player.bench.length); playSound('click'); }} className="shrink-0 w-24 h-32 md:w-32 md:h-48 border-2 border-dashed border-slate-700 rounded-md bg-slate-900/30 flex items-center justify-center hover:bg-slate-800/50 cursor-pointer text-slate-600 hover:text-slate-400 text-4xl transition-colors">+</div>
        )}
      </div>

      <div className={`flex justify-center items-center gap-2 md:gap-8 relative z-10 ${isOpponent ? 'order-2 mb-1 md:mb-2' : 'order-1'}`}>
        <div className={`text-right ${isOpponent ? 'self-end mb-4' : 'self-start mt-4'} w-20 md:w-32 hidden md:block`}>
            <h3 className={`font-bold truncate ${isCurrentTurn ? 'text-yellow-400 text-lg' : 'text-slate-400'}`}>{player.name}</h3>
            {player.mustPromote && <div className="text-red-500 font-bold text-xs animate-pulse">PROMOTE!</div>}
            <div className="flex justify-end gap-3 text-xs text-slate-500 mt-1"><span className="flex items-center gap-1"><Layers size={12}/> {player.deckCount}</span><span className="flex items-center gap-1"><FileText size={12}/> {player.handCount}</span></div>
        </div>
        
        <CardSlot pokemon={player.active} theme={player.deckTheme} isOpponent={isOpponent} isActive={true} interactionMode={interactionMode} onInteract={() => onCardClick('active', undefined, player.id)} onOpenSelector={() => onOpenSelector('active')} onOpenDetails={() => onOpenDetails('active', undefined, player.id)} />
        
        <div className={`flex flex-col gap-1 ${isOpponent ? 'self-end mb-4' : 'self-start mt-4'} w-16 md:w-32`}>
            <div className="text-[10px] md:text-xs text-slate-500 uppercase font-bold tracking-wider hidden md:block">Prêmios</div>
            <div className="flex gap-1 flex-wrap justify-end md:justify-start">
                {Array.from({length: player.prizesLeft}).map((_, i) => <div key={i} className="w-4 h-6 md:w-6 md:h-8 rounded border border-slate-600 bg-slate-700"></div>)}
            </div>
        </div>
      </div>
    </div>
  );
};

const CardSelectionModal = ({ deckTheme, onSelect, onClose }: any) => {
    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-sm w-full p-4 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center border-b border-slate-800 pb-2"><h3 className="font-bold text-white flex items-center gap-2"><Layers size={18}/> Selecionar Carta</h3><button onClick={() => { onClose(); playSound('click'); }}><X size={18} className="text-slate-500 hover:text-white"/></button></div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                    {deckTheme?.acePokemon.map((pokeName: string, idx: number) => {
                        const known = CARD_DATABASE[pokeName];
                        return (
                            <button key={idx} onClick={() => { onSelect(pokeName, known ? known.maxHP : 60, known ? known.type : 'COLORLESS'); playSound('click'); }} className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 p-3 rounded-lg flex items-center justify-between group transition-colors">
                                <span className="font-bold text-white">{pokeName}</span>
                                <div className="flex items-center gap-2"><span className="text-xs text-slate-400 font-mono">HP {known ? known.maxHP : 60}</span><EnergyBadge type={known ? known.type : 'COLORLESS'} /></div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

const SetupModal = ({ players, onSelectDeck, onSetActive, onConfirm, onNameChange }: any) => {
     return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
                <h2 className="text-3xl font-bold text-white text-center mb-8 flex items-center justify-center gap-3"><Gavel className="text-yellow-400"/> Preparação da Partida</h2>
                <div className="grid grid-cols-2 gap-8 mb-8">
                    {['P1', 'P2'].map(pid => (
                        <div key={pid} className="bg-slate-800 p-6 rounded-xl border border-slate-700 flex flex-col gap-4">
                            <h3 className={`text-xl font-bold ${pid === 'P1' ? 'text-blue-400' : 'text-red-400'}`}>{players[pid].name}</h3>
                            <div><label className="block text-xs uppercase text-slate-500 font-bold mb-2">Nome</label><input type="text" value={players[pid].name} onChange={(e) => onNameChange(pid, e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" /></div>
                            <div><label className="block text-xs uppercase text-slate-500 font-bold mb-2">Deck</label><div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar border border-slate-700 rounded p-1">{LEAGUE_DECKS.map(deck => (<button key={deck.id} onClick={() => { onSelectDeck(pid, deck.id); playSound('click'); }} className={`w-full text-left p-3 rounded border transition-all flex justify-between items-center ${players[pid].deckTheme?.id === deck.id ? 'bg-slate-700 border-blue-500 ring-1 ring-blue-500' : 'bg-slate-900/50 border-slate-700 hover:bg-slate-700'}`}><span className={`font-bold ${deck.textColor}`}>{deck.name}</span>{players[pid].deckTheme?.id === deck.id && <Check size={16} className="text-white"/>}</button>))}</div></div>
                            {players[pid].deckTheme && (<div className="animate-in fade-in slide-in-from-top-2"><label className="block text-xs uppercase text-yellow-500 font-bold mb-2 flex items-center gap-1"><UserCheck size={12}/> Ativo Inicial</label><div className="grid grid-cols-2 gap-2">{players[pid].deckTheme.acePokemon.map((pokeName: string) => (<button key={pokeName} onClick={() => { onSetActive(pid, pokeName); playSound('click'); }} className={`p-2 text-xs font-bold rounded border transition-all truncate ${players[pid].active?.name === pokeName ? 'bg-yellow-600 text-black border-yellow-400 ring-2 ring-yellow-400' : 'bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600'}`}>{pokeName}</button>))}</div></div>)}
                        </div>
                    ))}
                </div>
                <div className="text-center"><button onClick={() => { onConfirm(); playSound('click'); }} disabled={!players.P1.active || !players.P2.active} className="px-8 py-4 bg-yellow-500 hover:bg-yellow-400 disabled:bg-slate-600 disabled:text-slate-400 text-black font-bold text-lg rounded-full shadow-lg transition-all">Iniciar Partida</button></div>
            </div>
        </div>
    );
};

// --- MODAL DE ENERGIA PERSISTENTE ---
const EnergySelector = ({ onSelect, onCancel, count }: any) => (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in">
        <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-2xl max-w-sm w-full">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Zap className="text-yellow-400"/> Selecione a Energia</h3>
                <span className="bg-blue-600 text-white px-2 py-0.5 rounded text-[10px] font-bold">Total: {count}</span>
            </div>
            <div className="grid grid-cols-4 gap-3">{Object.keys(ENERGY_CONFIG).map((type: any) => { const config = ENERGY_CONFIG[type as EnergyType]; const Icon = config.icon; return (<button key={type} onClick={() => { onSelect(type); playSound('click'); }} className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all hover:scale-105 ${config.color.replace('text-', 'border-')}`}><Icon size={24} className="text-white mb-1"/><span className="text-[10px] font-bold text-white uppercase">{config.label}</span></button>); })}</div>
            {/* SÓ FECHA NESTE BOTÃO */}
            <button onClick={() => { onCancel(); playSound('click'); }} className="mt-6 w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-sm">PRONTO / CANCELAR</button>
        </div>
    </div>
);

// --- NOVO MODAL DE HISTÓRICO ---
interface MatchHistoryRecord {
    id: string;
    date: string;
    p1Name: string;
    p1Deck: string;
    p2Name: string;
    p2Deck: string;
    winner: string;
    events: GameEvent[];
}



export default function App() {
  const [state, dispatch] = useReducer(gameReducer, getInitialState());
  const [showAI, setShowAI] = useState(false);
  const [showRanking, setShowRanking] = useState(false);
  const [showHistory, setShowHistory] = useState(false); // NOVO
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('NONE');
  const [pendingEnergyTarget, setPendingEnergyTarget] = useState<{target: 'active' | 'bench', index?: number} | null>(null);
  const [selectorTarget, setSelectorTarget] = useState<{target: 'active' | 'bench', index?: number} | null>(null);
  const [detailsTarget, setDetailsTarget] = useState<{target: 'active' | 'bench', index?: number, playerId?: PlayerId} | null>(null);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [damagePool, setDamagePool] = useState(0);
  const [coinResult, setCoinResult] = useState<'CARA' | 'COROA' | null>(null);
  const [attackConfirm, setAttackConfirm] = useState<{attack: any, attacker: any, defender: any} | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);

  const activePlayer = state.players[state.currentPlayer];
  const promotingPlayer = state.players.P1.mustPromote ? state.players.P1 : (state.players.P2.mustPromote ? state.players.P2 : null);
  const opponentId = state.currentPlayer === 'P1' ? 'P2' : 'P1';

  // --- LÓGICA DE HISTÓRICO ADICIONADA ---
  // --- LÓGICA DE HISTÓRICO E RANKING (SUPABASE) ---
  useEffect(() => {
      if (state.winner) {
          const winnerDeck = state.players[state.winner].deckTheme;
          const winnerName = state.players[state.winner].name;

          if (winnerDeck) {
              // 1. Atualiza Ranking Global no Supabase (usando a função segura do SQL)
              supabase.rpc('register_win', { 
                  p_deck: winnerDeck.name, 
                  p_player: winnerName 
              }).then(({ error }) => {
                  if (error) console.error("Erro ao salvar ranking:", error);
              });

              // 2. O Histórico de Partidas detalhado pode continuar local ou ir para outra tabela
              // Por simplicidade, mantive o histórico de logs local, mas o ranking agora é Global.
              const matchRecord: MatchHistoryRecord = {
                  id: state.matchId,
                  date: new Date().toLocaleString(),
                  p1Name: state.players.P1.name,
                  p1Deck: state.players.P1.deckTheme?.name || 'Unknown',
                  p2Name: state.players.P2.name,
                  p2Deck: state.players.P2.deckTheme?.name || 'Unknown',
                  winner: winnerName,
                  events: state.events
              };
              const existingHistory = localStorage.getItem('judgeTech_match_history');
              const historyList: MatchHistoryRecord[] = existingHistory ? JSON.parse(existingHistory) : [];
              historyList.unshift(matchRecord); 
              localStorage.setItem('judgeTech_match_history', JSON.stringify(historyList));
          }
      }
  }, [state.winner]);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; }, [state.events]);

  const handleUseAttack = (atk: any, attacker: any, toolName?: string) => {
      if (atk.name === "ATTACH_TOOL_ACTION") {
          dispatch({ type: 'ATTACH_TOOL', toolName, target: detailsTarget?.target, index: detailsTarget?.index });
          setDetailsTarget(null);
          return;
      }
      const defender = state.players[opponentId].active;
      if (!defender) return;
      
      const prizesDiff = state.players[opponentId].prizesLeft - state.players[state.currentPlayer].prizesLeft;
      
      setAttackConfirm({ atk, attacker, defender, prizesDiff });
      setDetailsTarget(null);
  };

  const confirmAttackAction = (amount: number) => {
      dispatch({ type: 'ADD_DAMAGE', amount, target: 'active', playerId: opponentId, attackName: attackConfirm.atk.name });
      if (attackConfirm?.atk.name === "Mergulho Fantasma") { setDamagePool(60); setInteractionMode('DISTRIBUTE_DAMAGE'); }
      else { dispatch({ type: 'NEXT_PHASE' }); }
      setAttackConfirm(null);
  };

  const handleRetreatClick = () => { if (activePlayer.active) { setShowDiscardModal(true); playSound('click'); } };
  const handleConfirmDiscard = (indices: number[]) => { dispatch({ type: 'PAY_RETREAT_MANUAL', energyIndices: indices }); setShowDiscardModal(false); setInteractionMode('RETREAT_SELECT_NEW_ACTIVE'); playSound('click'); };

  const handleCardInteraction = (target: 'active' | 'bench', index?: number, targetPid?: PlayerId) => {
      if (promotingPlayer) { if (promotingPlayer.id === targetPid && target === 'bench' && typeof index === 'number') { dispatch({ type: 'PROMOTE_POKEMON', benchIndex: index, playerId: targetPid }); } return; }
      if (interactionMode === 'DISTRIBUTE_DAMAGE') { if (damagePool > 0) { dispatch({ type: 'ADD_DAMAGE', amount: 10, target, index, playerId: targetPid }); setDamagePool(prev => prev - 10); if (damagePool <= 10) setInteractionMode('NONE'); } return; }
      if (interactionMode === 'ATTACH_ENERGY') { if (targetPid === state.currentPlayer) setPendingEnergyTarget({ target, index }); return; }
      if (interactionMode === 'RETREAT_SELECT_NEW_ACTIVE' && targetPid === state.currentPlayer && target === 'bench' && typeof index === 'number') { dispatch({ type: 'SWAP_ACTIVE_BENCH', benchIndex: index }); setInteractionMode('NONE'); return; }
      setDetailsTarget({ target, index, playerId: targetPid });
  };

  const handleExportTxt = () => {
    const logContent = [...state.events].reverse().map(evt => `[${evt.timestamp}] ${evt.playerName}: ${evt.description}`).join('\n');
    const a = document.createElement('a');
    a.href = "data:text/plain;charset=utf-8," + encodeURIComponent(logContent);
    a.download = `log_${state.matchId}.txt`;
    a.click();
    playSound('click');
  };

  const handleSetCondition = (cond: SpecialCondition) => { if(!detailsTarget) return; dispatch({ type: 'SET_CONDITION', condition: cond, target: detailsTarget.target, index: detailsTarget.index, playerId: detailsTarget.pid }); };
  const handleAddDamageFromModal = (amount: number) => { if(!detailsTarget) return; dispatch({ type: 'ADD_DAMAGE', amount: amount, target: detailsTarget.target, index: detailsTarget.index, playerId: detailsTarget.pid }); };
  const handleUpdatePokemon = (newName: string) => { if (!selectorTarget) return; dispatch({ type: 'UPDATE_POKEMON', target: selectorTarget.target, index: selectorTarget.index, newName }); setSelectorTarget(null); };

  const handleCoinFlip = () => {
      playSound('coin');
      const result = Math.random() > 0.5 ? 'CARA' : 'COROA';
      setCoinResult(result);
      dispatch({ type: 'COIN_FLIP', result });
      setTimeout(() => setCoinResult(null), 2000);
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      
      {/* SIDEBAR RESPONSIVA ATUALIZADA (FECHA EM PC E MOBILE) */}
      <aside className={`
          fixed inset-y-0 left-0 z-40 bg-[#11141b] border-r border-slate-800 p-4 transition-all duration-300
          ${sidebarExpanded ? 'translate-x-0 w-72' : '-translate-x-full md:translate-x-0 md:w-0 md:p-0 md:border-none'} 
          shadow-2xl overflow-hidden
      `}>
          <div className="flex items-center justify-between gap-2 text-yellow-500 font-bold text-xs uppercase tracking-widest mb-4">
              <div className="flex items-center gap-2"><History size={14}/> Event Log</div>
              {/* Botão de fechar sidebar */}
              <button onClick={() => setSidebarExpanded(false)} className="text-slate-500 hover:text-white"><PanelLeftClose/></button>
          </div>
          <div className="flex-1 overflow-y-auto h-[80%] custom-scrollbar space-y-2 pb-20">
              {state.events.map(e => <div key={e.id} className="p-2 bg-slate-900 border-l-2 border-indigo-500 rounded text-[10px] text-slate-400"><b>{e.playerName}:</b> {e.description}</div>)}
          </div>
          
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-[#11141b] border-t border-slate-800 grid grid-cols-2 gap-2">
            <button onClick={() => setShowRanking(true)} className="bg-slate-800 py-2 rounded text-xs font-bold">Ranking</button>
            <button onClick={() => setShowHistory(true)} className="bg-slate-800 py-2 rounded text-xs font-bold">Histórico</button>
            <button onClick={() => setShowAI(true)} className="bg-indigo-900/50 py-2 rounded text-xs font-bold">Juiz IA</button>
            <button onClick={handleExportTxt} className="bg-slate-800 py-2 rounded text-xs font-bold">Exportar</button>
        </div>
      </aside>

      {/* OVERLAY PARA FECHAR SIDEBAR NO MOBILE */}
      {sidebarExpanded && <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setSidebarExpanded(false)}></div>}

      <main className="flex-1 flex flex-col relative bg-[#1a1c23] w-full transition-all duration-300">
        {coinResult && (
            <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/50 pointer-events-none animate-in zoom-in">
                <div className="bg-yellow-400 text-black font-black text-6xl px-12 py-8 rounded-full border-8 border-yellow-200 shadow-2xl drop-shadow-[0_0_50px_rgba(234,179,8,0.8)]">
                    {coinResult}
                </div>
            </div>
        )}

        {promotingPlayer && <PromotionModal player={promotingPlayer} onPromote={(idx) => { dispatch({ type: 'PROMOTE_POKEMON', benchIndex: idx, playerId: promotingPlayer.id }); playSound('click'); }} onForceRestart={() => { dispatch({ type: 'RESET_GAME' }); playSound('click'); }}/>}
        {state.winner && <WinnerModal winnerName={state.players[state.winner].name} onRestart={() => { dispatch({ type: 'RESET_GAME' }); playSound('click'); }} />}
        {state.phase === 'SETUP' && <SetupModal players={state.players} onSelectDeck={(pid:any, did:any) => dispatch({ type: 'SET_DECK', playerId: pid, deckId: did })} onSetActive={(pid:any, name:any) => dispatch({ type: 'SET_ACTIVE', playerId: pid, pokemonName: name })} onConfirm={() => dispatch({type: 'NEXT_PHASE'})} onNameChange={(pid:any, name:any) => dispatch({ type: 'SET_PLAYER_NAME', playerId: pid, name })} />}
        
        {/* MODAIS */}
        {attackConfirm && <DamageConfirmModal attack={attackConfirm.atk} attacker={attackConfirm.attacker} defender={attackConfirm.defender} prizesDiff={attackConfirm.prizesDiff} onConfirm={confirmAttackAction} onCancel={() => setAttackConfirm(null)} />}
        {pendingEnergyTarget && <EnergySelector count={(pendingEnergyTarget.target === 'active' ? state.players[state.currentPlayer].active?.energies.length : state.players[state.currentPlayer].bench[pendingEnergyTarget.index!]?.energies.length) || 0} onSelect={(t: EnergyType) => dispatch({type: 'ATTACH_ENERGY', target: pendingEnergyTarget.target, index: pendingEnergyTarget.index, energyType: t})} onCancel={() => { setPendingEnergyTarget(null); setInteractionMode('NONE'); playSound('click'); }} />}
        {selectorTarget && <CardSelectionModal deckTheme={activePlayer.deckTheme} onSelect={handleUpdatePokemon} onClose={() => setSelectorTarget(null)} />}
        {detailsTarget && <CardDetailsModal pokemon={detailsTarget.target === 'active' ? state.players[detailsTarget.playerId!].active : state.players[detailsTarget.playerId!].bench[detailsTarget.index!]} onClose={() => setDetailsTarget(null)} onUseAbility={(name:any) => { dispatch({type: 'USE_ABILITY', abilityName: name, pokemonName: detailsTarget.target === 'active' ? state.players[detailsTarget.playerId!].active?.name : state.players[detailsTarget.playerId!].bench[detailsTarget.index!].name }); playSound('energy'); }} onUseAttack={handleUseAttack} onSetCondition={handleSetCondition} onAddDamage={handleAddDamageFromModal} onEvolve={(name:string) => { dispatch({type: 'EVOLVE_POKEMON', target: detailsTarget.target, index: detailsTarget.index, evolutionName: name}); setDetailsTarget(null); }} />}
        {showDiscardModal && activePlayer.active && <EnergyDiscardModal energies={activePlayer.active.energies} cost={activePlayer.active.retreatCost} onConfirm={handleConfirmDiscard} onCancel={() => { setShowDiscardModal(false); playSound('click'); }} />}
        <RankingModal isOpen={showRanking} onClose={() => { setShowRanking(false); playSound('click'); }} />
        <HistoryModal isOpen={showHistory} onClose={() => { setShowHistory(false); playSound('click'); }} />
        <AIModal isOpen={showAI} onClose={() => { setShowAI(false); playSound('click'); }} events={state.events} activePlayerName={activePlayer.name} gameState={state} />

        {/* HEADER RESPONSIVO */}
        <div className="h-14 bg-[#161b22] border-b border-slate-800 flex justify-between items-center px-4 md:px-10 shrink-0 z-20">
             <div className="flex items-center gap-2 md:gap-4">
                 {/* Botão de Menu SEMPRE VISÍVEL AGORA */}
                 <button onClick={() => setSidebarExpanded(!sidebarExpanded)} className="text-slate-400 hover:text-white transition-colors">
                     {sidebarExpanded ? <PanelLeftClose size={20}/> : <Menu size={20}/>}
                 </button>
                 <span className="font-black text-indigo-400 text-xs md:text-sm">T{state.turnNumber}</span>
                 <span className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 px-2 py-0.5 rounded-full text-[9px] md:text-[10px] font-black uppercase">{state.phase}</span>
             </div>
             
             {/* BOTÕES DE AÇÃO */}
             <div className="flex gap-2">
                <button onClick={handleCoinFlip} className="p-2 hover:bg-slate-700 text-yellow-400 rounded bg-slate-800/50" title="Jogar Moeda"><Coins size={16}/></button>
                <button onClick={() => { dispatch({ type: 'DRAW_CARD', count: 1 }); playSound('click'); }} className="p-2 hover:bg-slate-700 rounded text-blue-400 bg-slate-800/50" title="Comprar Carta"><History size={16}/></button>
                <button onClick={() => setInteractionMode(interactionMode === 'ATTACH_ENERGY' ? 'NONE' : 'ATTACH_ENERGY')} className={`p-2 rounded-xl transition-all ${interactionMode === 'ATTACH_ENERGY' ? 'bg-yellow-500 text-black' : 'bg-slate-800/50 text-slate-400'}`} title="Ligar Energia"><Zap size={16}/></button>
                {/* BOTÃO DE APOIADOR NA TOP BAR */}
                <button onClick={() => { dispatch({ type: 'PLAY_SUPPORTER' }); playSound('click'); }} className="p-2 hover:bg-slate-700 rounded text-purple-400 bg-slate-800/50" title="Jogar Apoiador"><Layers size={16}/></button>
                <button onClick={() => handleRetreatClick()} className={`p-2 rounded-xl ${interactionMode === 'RETREAT_SELECT_NEW_ACTIVE' ? 'bg-green-600 text-white' : 'bg-slate-800/50 text-slate-400'}`} title="Recuar"><RotateCcw size={16}/></button>
                <button onClick={() => dispatch({type: 'NEXT_PHASE'})} className="bg-indigo-600 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg ml-2">Avançar</button>
             </div>
        </div>

        {/* AREA DO JOGO */}
        <div className="flex-1 flex flex-col p-2 md:p-8 gap-2 md:gap-8 overflow-hidden">
            <div className="flex-1 flex flex-col items-center justify-end md:justify-center bg-red-500/5 rounded-2xl md:rounded-3xl border border-red-500/10 relative pb-2">
                <PlayerPanel 
                    player={state.currentPlayer === 'P1' ? state.players.P2 : state.players.P1} 
                    isCurrentTurn={false} isOpponent={true} 
                    interactionMode={interactionMode} 
                    onCardClick={handleCardInteraction} 
                    onOpenSelector={() => {}} 
                    onOpenDetails={(t: any, i: any, pid: any) => setDetailsTarget({ target: t, index: i, playerId: pid })}
                />
            </div>
            <div className="flex-1 flex flex-col items-center justify-start md:justify-center bg-blue-500/5 rounded-2xl md:rounded-3xl border border-blue-500/10 relative pt-2">
                 <PlayerPanel 
                    player={activePlayer} 
                    isCurrentTurn={true} isOpponent={false} 
                    interactionMode={interactionMode} 
                    onCardClick={handleCardInteraction} 
                    onOpenSelector={(t: any, i: any) => setSelectorTarget({target: t, index: i})} 
                    onOpenDetails={(t: any, i: any, pid: any) => setDetailsTarget({target: t, index: i, playerId: pid})}
                />
            </div>
        </div>
      </main>
    </div>
  );
}