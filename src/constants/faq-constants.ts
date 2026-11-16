/**
 * Maximum character length for an FAQ question.
 */
export const FAQ_QUESTION_MAX_LENGTH = 300;

/**
 * Maximum character length for an FAQ answer.
 */
export const FAQ_ANSWER_MAX_LENGTH = 10000;

/**
 * Maximum character length for an FAQ category identifier/name.
 */
export const FAQ_CATEGORY_MAX_LENGTH = 100;

/**
 * Default category assigned to an FAQ entry when none is specified.
 */
export const DEFAULT_FAQ_CATEGORY = 'Ogólne';

/**
 * Shape of a default seeded FAQ entry derived from the project requirements document.
 */
export type DefaultFaqSeedItem = {
  readonly question: string;
  readonly answer: string;
  readonly category: string;
  readonly orderIndex: number;
};

/**
 * Default FAQ entries generated line-by-line from the MyAcademyQuest Project Requirements Document (Sections 1–10),
 * strictly following the official UI role vocabulary (osoba studiująca, osoba prowadząca, osoba administrująca, osoba nadzorująca).
 */
export const DEFAULT_FAQ_SEED_ITEMS: readonly DefaultFaqSeedItem[] = [
  {
    category: 'Ogólne',
    orderIndex: 0,
    question: 'Czym jest platforma MyAcademyQuest i jaki jest jej główny cel?',
    answer:
      'MyAcademyQuest to akademicki system webowy wspierająca motywację, zaangażowanie i systematyczność osób studiujących poprzez grywalizację, warstwę fabularną, wirtualną walutę oraz sklep bonusów dydaktycznych. W przeciwieństwie do narzędzi takich jak Kahoot!, platforma nie posiada modułu testowania wiedzy (quizów ani egzaminów) oraz nie zawiera wewnętrznego czatu społecznościowego.',
  },
  {
    category: 'Ogólne',
    orderIndex: 1,
    question: 'Czy do korzystania z MyAcademyQuest potrzebna jest aplikacja mobilna?',
    answer:
      'Nie. System został zrealizowany wyłącznie jako responsywna aplikacja webowa typu Single Page Application (React + Vite), dostępna bezpośrednio w przeglądarce internetowej bez konieczności instalacji dodatkowego oprogramowania. Interfejs dopasowuje się do ekranów o poziomej rozdzielczości od 320 do 3840 pikseli na komputerach oraz urządzeniach mobilnych (Windows, Android).',
  },
  {
    category: 'Konto i logowanie',
    orderIndex: 2,
    question: 'Jak zalogować się do systemu (SSO PIONIER.id oraz Magic Links)?',
    answer:
      'Osoby studiujące oraz pracownicy uczelni logują się bezobsługowo za pomocą swoich kont uczelnianych w ramach logowania jednokrotnego SSO opartego na protokole SAML 2.0 (federacja PIONIER.id z szyfrowaniem asymetrycznym i certyfikatami X.509). Dla użytkowników spoza federacji PIONIER.id (np. ze szkół współpracujących) udostępniono bezhasłowy mechanizm Magic Links wysyłający link dostępowy na adres e-mail.',
  },
  {
    category: 'Konto i logowanie',
    orderIndex: 3,
    question: 'Co należy skonfigurować przy pierwszym logowaniu i do czego służy pseudonim?',
    answer:
      'Przy pierwszym logowaniu użytkownik tworzy profil, konfiguruje podstawowe ustawienia konta oraz ustawia swój pseudonim. Pseudonim jest wykorzystywany w systemie rankingowym, dzięki czemu osoby studiujące mogą porównywać swoje postępy z wynikami innych uczestników i rywalizować bez ujawniania swoich danych osobowych.',
  },
  {
    category: 'Grupy i zajęcia',
    orderIndex: 4,
    question: 'W jaki sposób osoba studiująca może dołączyć do grupy zajęciowej?',
    answer:
      'Osoba prowadząca generuje dla utworzonej grupy specjalny kod dostępu (oraz kod QR do szybkiej rejestracji). Osoba studiująca może wpisać kod w widoku „Twoje Grupy”, zeskanować kod QR lub zostać przypisana do kursu bezpośrednio przez osobę prowadzącą (również masowo poprzez import z pliku CSV).',
  },
  {
    category: 'Grywalizacja i sklep',
    orderIndex: 5,
    question: 'Jak zdobywać wirtualną walutę i wymieniać ją na bonusy dydaktyczne?',
    answer:
      'Osoba prowadząca przyznaje osobom studiującym wirtualną walutę za aktywność, systematyczność i postępy w zadaniach opisanych na tablicy grupy. Zdobyte środki osoba studiująca może wymieniać w cyfrowym sklepie grupy na bonusy dydaktyczne przygotowane przez osobę prowadzącą, z uwzględnieniem dynamicznych zniżek wynikających z posiadanych rang.',
  },
  {
    category: 'Grywalizacja i sklep',
    orderIndex: 6,
    question: 'Jak działa system 3 szans (żyć) i co się dzieje po utracie wszystkich szans?',
    answer:
      'Osoby studiujące dysponują systemem 3 szans, unikalnych dla każdej grupy zajęciowej. Osoba prowadząca ma możliwość odejmowania szans zgodnie z własnymi zasadami kursu. Gdy osoba studiująca utraci wszystkie szanse, jej możliwość zakupu przedmiotów w sklepie zostaje ograniczona wyłącznie do dokupienia szansy, dopóki nie odzyska przynajmniej jednej szansy.',
  },
  {
    category: 'Grywalizacja i sklep',
    orderIndex: 7,
    question: 'W jaki sposób przyznawane są rangi oraz odznaki?',
    answer:
      'Osoba prowadząca tworzy w dedykowanym edytorze rangi oraz odznaki i definiuje reguły ich zdobywania. System automatycznie klasyfikuje osoby studiujące i nadaje rangi oraz odznaki po spełnieniu określonych kryteriów osiągnięć. Dodatkowo osoba prowadząca może przydzielać rangi i odznaki osobiście.',
  },
  {
    category: 'Grywalizacja i sklep',
    orderIndex: 8,
    question: 'Gdzie można sprawdzić swoje postępy, zdobyte nagrody i historię transakcji?',
    answer:
      'W widoku profilu osoby studiującej znajdują się pełne informacje o postępach w kursie, aktualnych aktywnościach, zdobytych rangach, odznakach i nagrodach, a także kompletna historia transakcji dokonanych w sklepie, co pozwala na bieżąco śledzić swoje wydatki.',
  },
  {
    category: 'Dla osób prowadzących',
    orderIndex: 9,
    question: 'Jak spersonalizować grupę zajęciową i korzystać z Galerii Szablonów?',
    answer:
      'Osoba prowadząca może skonfigurować własną nazwę waluty i szans, edytować fabularny opis kursu, przesyłać grafikę grupy oraz dodawać wpisy fabularne i opisy aktywności. Konfigurację grupy można zapisać jako szablon na przyszłe semestry lub skorzystać z Galerii Szablonów, kopiując gotowe scenariusze grywalizacyjne i warstwę fabularną utworzone przez inne osoby prowadzące.',
  },
  {
    category: 'Dla osób prowadzących',
    orderIndex: 10,
    question: 'Jak wygląda integracja z platformą Moodle oraz import i eksport plików CSV?',
    answer:
      'System jest całkowicie niezależny od zewnętrznych platform e-learningowych, a wymiana danych z Moodle odbywa się poprzez pliki CSV. Osoba prowadząca może importować z plików CSV listy uczestników kursu, punktację i wyniki osób studiujących, jedną bądź wiele aktywności oraz odznaki, a także generować i eksportować do formatu CSV szczegółowe raporty końcowe z aktywności, transakcji oraz pełnego dziennika grupy.',
  },
  {
    category: 'Dostępność i technologia',
    orderIndex: 11,
    question: 'Czy aplikację można obsługiwać wyłącznie klawiaturą i w różnych językach?',
    answer:
      'Tak. Interfejs spełnia wymagania standardu WCAG 2.1 na poziomie AA i umożliwia pełną obsługę wszystkich funkcjonalności wyłącznie za pomocą klawiatury, bez konieczności używania myszy. Aplikacja obsługuje również zmianę języka interfejsu (język polski oraz angielski).',
  },
  {
    category: 'Dostępność i technologia',
    orderIndex: 12,
    question: 'Jak gwarantowane jest bezpieczeństwo sald waluty, wydajność oraz licencjonowanie kodu?',
    answer:
      'Wszystkie operacje transakcyjne na wirtualnej walucie i zakupach w sklepie są przetwarzane w relacyjnej bazie danych PostgreSQL z pełnym wsparciem transakcji ACID oraz więzów integralności, co wyklucza anomalie w saldach. Serwer w środowisku Node.js i Docker zapewnia płynną obsługę do 100 jednoczesnych użytkowników (czas odpowiedzi poniżej 200 ms dla do 10 niezależnych kursów). Kod źródłowy udostępniany jest społeczności akademickiej na otwartej Licencji MIT.',
  },
  {
    category: 'Administracja',
    orderIndex: 13,
    question: 'Czym różnią się uprawnienia osoby administrującej od osoby nadzorującej?',
    answer:
      'System rozróżnia cztery główne role: osoba studiująca, osoba prowadząca, osoba administrująca oraz osoba nadzorująca. Osoba administrująca zarządza kontami użytkowników w swojej organizacji, ma pełen dostęp do każdej grupy utworzonej w obrębie swojej uczelni oraz przegląda statystyki organizacji. Osoba nadzorująca zarządza wszystkimi organizacjami (uczelniami), nadaje uprawnienia osoby administrującej użytkownikom w organizacjach, przegląda globalne statystyki systemu oraz edytuje zasoby globalne, takie jak strona FAQ czy dokumenty systemowe.',
  },
] as const;
