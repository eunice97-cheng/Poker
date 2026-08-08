# ASL Punto Banco Baccarat Design

## Position In ASL Gaming Casino

Punto Banco is planned as the third casino game, but it should stay hidden until launch. During development, it should be reachable only through a temporary GM-visible preview button.

Launch behavior later: replace the current middle "Coming Soon" card in the main ASL Gaming Casino lobby when the game is ready for players.

Recommended room name: **ASL Punto Banco Salon**

Alternate title options:

- **Dragon Pearl Baccarat**
- **Moon Gate Baccarat**
- **ASL Banco Salon**

Best fit for the current casino brand: **ASL Punto Banco Salon**. It reads premium, clear, and specific to the actual Baccarat variant.

## Game Identity

Punto Banco is a fast house-banked Baccarat game where every player bets on one shared round outcome. Players do not choose whether to draw. The dealer resolves the hand using fixed third-card rules.

This makes it a clean third game after Poker and Blackjack:

- Poker: player-versus-player, slower and social.
- Blackjack: player-versus-dealer, turn-based decisions.
- Punto Banco: shared-table betting, automatic reveal, fast rhythm.

## Core Table Mood

Visual direction:

- Deep lacquer red, jade green, polished black, warm gold, and pale ivory card surfaces.
- A symmetrical table with **Punto** on the left, **Banco** on the right, and **Tie** in the center.
- A visible shoe and discard tray near the dealer zone.
- A compact results road on the side so players can read table rhythm at a glance.

The table should feel like a quieter high-limit salon instead of another blackjack lounge. Less bar-room energy, more ritualized reveal.

## Baccarat Rules

Use standard Punto Banco with an 8-deck shoe.

Card values:

- Ace = 1
- 2-9 = face value
- 10, Jack, Queen, King = 0
- Hand total = final digit only. Example: 7 + 8 = 15, total is 5.

Initial deal:

- Two cards to Punto.
- Two cards to Banco.
- If either hand has a natural 8 or 9, both hands stand.

Punto third-card rule:

- Punto draws on 0-5.
- Punto stands on 6-7.

Banco rule if Punto stands:

- Banco draws on 0-5.
- Banco stands on 6-7.

Banco rule if Punto draws:

- Banco total 0-2: draw.
- Banco total 3: draw unless Punto third card is 8.
- Banco total 4: draw if Punto third card is 2-7.
- Banco total 5: draw if Punto third card is 4-7.
- Banco total 6: draw if Punto third card is 6-7.
- Banco total 7: stand.

Settlement:

- Punto win: Punto bet pays 1:1.
- Banco win: Banco bet pays 0.95:1, using the standard 5% commission.
- Tie: Tie bet pays 8:1, Punto and Banco bets push.

Optional side bets for later:

- Punto Pair: first two Punto cards are same rank, pays 11:1.
- Banco Pair: first two Banco cards are same rank, pays 11:1.

## Round Flow

Recommended timing:

- Betting open: 12 seconds after the first chip lands.
- Bets closed pause: 1 second.
- Initial deal: four cards, one at a time.
- Natural check pause: 1.2 seconds.
- Third-card reveal if needed.
- Result hold: 4 seconds.
- Next round countdown: 5 seconds.

Player flow:

1. Join table with buy-in.
2. Sit or watch as observer.
3. Place chips on Punto, Banco, Tie, and optionally pairs.
4. Countdown closes betting automatically.
5. Dealer reveals cards and resolves fixed rules.
6. Winnings return to player table stack.
7. Results road updates.
8. Next betting window opens.

## Betting Controls

Chip values:

- 10
- 20
- 50
- 100
- 500
- 1000

Primary betting spots:

- Punto
- Banco
- Tie

Optional side spots:

- Punto Pair
- Banco Pair

Useful controls:

- Clear Bet
- Rebet
- Double Bet
- Cash Out
- Sit Out
- Rules
- Audio

## Table UI Layout

Desktop table:

- Top center: dealer portrait, shoe, round message, countdown.
- Left hand zone: **Punto** cards and total.
- Right hand zone: **Banco** cards and total.
- Center lower zone: large Tie betting spot.
- Lower left/right: Punto and Banco betting spots.
- Lower edge: player stack, selected chip rail, Clear/Rebet/Double.
- Right rail: results road and session history.
- Bottom/right floating: table chat, matching blackjack chat behavior.

Mobile landscape:

- Keep the table full-screen.
- Collapse history into a right-side icon button.
- Keep chips as a horizontal rail.
- Show only the player's own bet totals on the main spots to reduce clutter.

## Results Road

Start simple with a bead road:

- Blue bead = Punto.
- Red bead = Banco.
- Green bead = Tie.
- Small gold ring = Pair occurred.

Persist at least the latest 60 outcomes in room memory. A later phase can store table road history in Supabase if wanted.

## Server Architecture

Create Baccarat as a sibling to Blackjack:

- `server/src/types/baccarat.ts`
- `server/src/rooms/BaccaratRoom.ts`
- `server/src/rooms/BaccaratRoomManager.ts`
- `server/src/handlers/baccaratHandler.ts`

Add registration in:

- `server/src/index.ts`
- `server/src/handlers/connectionHandler.ts`

Add live tables endpoint:

- `GET /baccarat/tables`

Socket events:

- `baccarat_create_table`
- `baccarat_join_table`
- `baccarat_reconnect_to_table`
- `baccarat_leave_table`
- `baccarat_sit_in`
- `baccarat_sit_out`
- `baccarat_place_bet`
- `baccarat_clear_bets`
- `baccarat_rebet`
- `baccarat_double_bets`
- `baccarat_rebuy`
- `baccarat_chat_message`
- `baccarat_table_created`
- `baccarat_table_updated`
- `baccarat_table_deleted`
- `baccarat_action_log`
- `baccarat_busted`

## Baccarat State Shape

Important server state:

- `phase`: betting, dealing, drawing, settled.
- `deck`: 8-deck shoe.
- `puntoCards`
- `bancoCards`
- `puntoTotal`
- `bancoTotal`
- `players`
- `observers`
- `roundNumber`
- `resultRoad`
- `bettingEndsAt`
- `nextRoundStartsAt`
- `message`

Player state:

- `stack`
- `bets`: punto, banco, tie, puntoPair, bancoPair.
- `lastBets`
- `lastNet`
- `lastResult`

## Database Changes

The current `tables.game_type` check only allows `poker` and `blackjack`.

Add a migration:

```sql
ALTER TABLE tables
  DROP CONSTRAINT IF EXISTS tables_game_type_check;

ALTER TABLE tables
  ADD CONSTRAINT tables_game_type_check
  CHECK (game_type IN ('poker', 'blackjack', 'baccarat'));
```

If dealer tips are reused, add a baccarat dealer tips table or generalize the existing blackjack tips system into a broader casino dealer tip table.

## Frontend Architecture

Create routes:

- `frontend/app/baccarat/page.tsx`
- `frontend/app/baccarat/BaccaratLobbyClient.tsx`
- `frontend/app/baccarat/table/[tableId]/page.tsx`
- `frontend/app/baccarat/table/[tableId]/BaccaratTableClient.tsx`

Create shared type/hooks:

- `frontend/types/baccarat.ts`
- `frontend/hooks/useBaccaratState.ts`

Assets:

- `frontend/public/baccarat/Images/Background/Baccarat Lobby.png`
- `frontend/public/baccarat/Images/Table/Table.png`
- `frontend/public/baccarat/Images/Logo/asl-punto-banco-logo.png`
- `frontend/public/casino-lobby/baccarat-poster.png`
- `frontend/public/casino-lobby/baccarat-poster-mobile.png`

Temporary GM preview updates:

- Keep the public casino lobby card layout unchanged.
- Add a GM/local-admin-only preview button to `frontend/app/CasinoLobbyClient.tsx`.
- Add a protected preview route at `frontend/app/baccarat/page.tsx`.
- Add a GM dashboard shortcut in `frontend/app/gm/GMClient.tsx`.

Launch updates later:

- Add Baccarat stats to `frontend/app/page.tsx`.
- Extend `CasinoLobbyClient` game cards to include Baccarat.
- Replace `ComingSoonCard` with Baccarat in the middle slot.

## MVP Scope

Build first:

- Baccarat lobby.
- Create/join/cashout table.
- Shared betting on Punto, Banco, Tie.
- 8-deck shoe and full third-card rules.
- Automatic countdown and settlement.
- Bead-road result history.
- Table chat.
- Rebuy.
- Responsive desktop and compact landscape layout.

Save for later:

- Pair side bets.
- Dealer portrait rotation and voice lines.
- Advanced roads: Big Road, Big Eye Boy, Small Road, Cockroach Pig.
- Commission ledger display for Banco if the casino wants visual commission tracking.
- Baccarat-specific achievements or daily missions.

## Dealer Copy

Short lines that fit Punto Banco:

- "Place your bets, please."
- "No more bets."
- "Cards are in motion."
- "Natural eight."
- "Natural nine."
- "Punto draws."
- "Banco draws."
- "Punto wins."
- "Banco wins."
- "Tie hand."
- "Bets are settled."
- "The shoe is reshuffled."

## Recommended First Build

Start with a clean MVP using the blackjack socket/economy pattern. Baccarat should not inherit blackjack action logic, insurance, splits, or turn timers. Its strength is speed: one betting window, one automatic reveal, one satisfying result.
