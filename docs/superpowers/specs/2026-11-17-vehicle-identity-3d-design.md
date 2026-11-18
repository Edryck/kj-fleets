# Identidade dos veículos e modelos 3D próprios

Pedido do dono do produto durante a Fase 10 do redesign geoespacial (2026-11-17):

- "quero que cada veículo tenha o modelo 3d do modelo dele"
- "qualquer coisa use o blender para fazê-los"
- "nas informações do veículo precisamos de mais informações sobre o veículo como modelo, placa e afins, precisamos de coesão"
- "eu quero o modelo 3d 'real' do veículo, pelo menos algo parecido"
- "usuário, motorista, clientes. quero modelos 3D deles também!!"

Escolhas dele nas perguntas: campos marca e modelo, ano e cor, capacidade (kg e m³) e hodômetro; uma figura 3D por papel; só imagens renderizadas, sem 3D interativo.

## Objetivo

Todo lugar que mostra um veículo mostra o mesmo conjunto: placa, marca e modelo, o render parecido com o modelo real e pintado na cor do cadastro. Toda pessoa ganha a figura 3D do seu papel. O visual segue o redesign: argila clara, detalhe limão e sombra suave.

## Não-objetivos

- 3D interativo (visualizador que gira). O dono escolheu imagens.
- Avatar por pessoa. A figura é do papel, não inventa a aparência de ninguém.
- Logotipos ou marcas registradas nos renders. Os modelos lembram os reais pela silhueta e pelas proporções.
- Mudar regras de despacho com a capacidade nova. Ela é informativa.

## Backend (exceção aprovada à regra "sem backend" do redesign)

- `Vehicle` ganha colunas opcionais: `brand` (até 40), `model` (até 60), `model_year` (1980 até o ano atual + 1), `color` (até 20), `capacity_kg` (1 a 60.000), `volume_m3` (0,1 a 150) e `odometer_km` (0 a 5.000.000). O `ddl-auto=update` cria as colunas sem apagar nada.
- `VehicleRequest` e `VehicleResponse` ganham `brand`, `model`, `year`, `color`, `capacityKg`, `volumeM3` e `odometerKm`. Texto vem aparado, e texto vazio vira `null`. Valores fora da faixa respondem 400.
- O motorista já embute `VehicleResponse`, então o mapa ao vivo, os motoristas e o pedido recebem os campos sem outra mudança.
- A busca `q` da lista de veículos passa a casar placa, tipo, marca e modelo.

## Frontend

- **Catálogo** (`src/vehicles/catalog.ts`):
  - tipos fixos: Van, Furgão, Caminhão leve, Caminhão e Moto;
  - dez modelos, cada um com tipo e render próprio:
    - Mercedes-Benz Sprinter e Fiat Ducato (Van);
    - Fiat Fiorino e Renault Kangoo (Furgão);
    - Volkswagen Delivery e Mercedes-Benz Accelo (Caminhão leve);
    - Volkswagen Constellation e Mercedes-Benz Atego (Caminhão);
    - Honda CG 160 Cargo e Honda Biz 125 (Moto);
  - paleta de cores com nome e hex: Branco, Prata, Cinza, Preto, Vermelho, Azul, Amarelo, Verde e Laranja.
- **Render:** `vehicleRender(vehicle, view)` procura marca e modelo no catálogo, sem diferenciar acentos nem maiúsculas. Sem resultado, usa o modelo padrão do tipo: Sprinter, Fiorino, Delivery, Constellation e CG. Sem tipo conhecido, devolve `null` ("Sem imagem para …", como hoje).
- **Cor:** cada render tem uma máscara da pintura. O componente `VehicleRender` pinta a máscara com a cor do cadastro (multiplicação isolada), e a imagem fica intacta. Branco ou sem cor mostra a argila clara.
- **Formulário:**
  - tipo vira lista, e um tipo antigo fora da lista continua como opção;
  - marca e modelo têm sugestões do catálogo, filtradas pelo tipo, e um modelo do catálogo ajusta o tipo sozinho;
  - ano, cor (lista), capacidade, volume e hodômetro.
- **Coesão:** o rótulo `vehicleName(v)` dá "Marca Modelo", ou o tipo quando faltam marca e modelo. Ele é usado em:
  - cartão da garagem e detalhe do veículo;
  - `VehicleCard` (painel e detalhe do motorista, detalhe do pedido);
  - cartão do motorista no mapa ao vivo;
  - lista de motoristas.

  O detalhe do veículo lista todos os campos, com "Não informado" quando falta.

## Renders (Blender 5.3, Cycles)

- **Gerador:** `docs/design/vehicles/build_vehicles.py` monta os modelos por código (sem arquivos de terceiros). São modelos paramétricos por família: vans, caminhões com cabine avançada e motos.
- **Saídas** em `frontend/public/renders/`:
  - `<chave>-34.webp` e `<chave>-side.webp`, com alfa e sombra de contato;
  - `<chave>-34-paint.webp` e `<chave>-side-paint.webp`, máscaras da pintura.

  Os renders antigos `van-*` e `truck-*` saem.
- **Estúdio:** luz de estúdio suave, pintura argila clara (multiplicável), faixa limão, vidros escuros esverdeados, plásticos pretos e rodas cinza.

## Figuras das pessoas

- **Gerador:** `docs/design/people/build_people.py` monta cinco figuras estilizadas sem rosto, em argila clara com detalhe limão:
  - administrador com notebook;
  - despachante com fone e tablet;
  - gestor de frota com prancheta e capacete;
  - motorista com boné e colete segurando uma caixa;
  - cliente recebendo um pacote.
- **Saídas:** `frontend/public/people/<papel>.webp` (corpo inteiro, 3/4) e `<papel>-bust.webp` (busto para avatar).
- **Onde aparecem:**
  - cabeçalho dos painéis de detalhe de motorista, cliente e usuário;
  - página Minha conta;
  - cartão da lista de motoristas;
  - avatar do chip do usuário no topo.

  As iniciais continuam como texto alternativo quando a imagem não carrega.

## Custo se algo estiver errado

- Os modelos podem não lembrar o real o bastante. O gerador fica no repositório para ajustar proporções.
- A cor multiplicada não tem reflexo próprio em cores escuras. O preto usa grafite para manter o volume.
