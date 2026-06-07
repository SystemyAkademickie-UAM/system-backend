--
-- PostgreSQL database dump
--

-- -- \restrict jnHGhu95iOvFKo4xTTbjM1b1ShkIN7TSnwGo8gb7bnC1kywpyVtqVSUIcTZ961w

-- Dumped from database version 13.16 (Debian 13.16-1.pgdg100+1)
-- Dumped by pg_dump version 18.3

-- Started on 2026-05-24 18:40:06

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
-- SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 9 (class 2615 OID 3451427)
-- Name: analytics; Type: SCHEMA; Schema: -; Owner: dev_user
--

CREATE SCHEMA analytics;



--
-- TOC entry 6 (class 2615 OID 3451424)
-- Name: auth; Type: SCHEMA; Schema: -; Owner: dev_user
--

CREATE SCHEMA auth;



--
-- TOC entry 7 (class 2615 OID 3451425)
-- Name: education; Type: SCHEMA; Schema: -; Owner: dev_user
--

CREATE SCHEMA education;



--
-- TOC entry 8 (class 2615 OID 3451426)
-- Name: gamification; Type: SCHEMA; Schema: -; Owner: dev_user
--

CREATE SCHEMA gamification;



--
-- TOC entry 5 (class 2615 OID 2200)
-- Name: public; Type: SCHEMA; Schema: -; Owner: dev_user
--

-- *not* creating schema, since initdb creates it



--
-- TOC entry 10 (class 2615 OID 3452932)
-- Name: services; Type: SCHEMA; Schema: -; Owner: dev_user
--

CREATE SCHEMA services;



--
-- TOC entry 3203 (class 0 OID 0)
-- Dependencies: 10
-- Name: SCHEMA services; Type: COMMENT; Schema: -; Owner: dev_user
--

COMMENT ON SCHEMA services IS 'Tables for services and other.';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 236 (class 1259 OID 3451676)
-- Name: activity_backlog; Type: TABLE; Schema: analytics; Owner: dev_user
--

CREATE TABLE analytics.activity_backlog (
    id integer NOT NULL,
    group_id integer,
    activity_id integer,
    account_id integer,
    date timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- TOC entry 234 (class 1259 OID 3451654)
-- Name: backlog; Type: TABLE; Schema: analytics; Owner: dev_user
--

CREATE TABLE analytics.backlog (
    id integer NOT NULL,
    group_id integer,
    account_id integer,
    type character varying(100),
    date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    value text
);



--
-- TOC entry 235 (class 1259 OID 3451674)
-- Name: backlog_aktywnosci_id_seq; Type: SEQUENCE; Schema: analytics; Owner: dev_user
--

CREATE SEQUENCE analytics.backlog_aktywnosci_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 3204 (class 0 OID 0)
-- Dependencies: 235
-- Name: backlog_aktywnosci_id_seq; Type: SEQUENCE OWNED BY; Schema: analytics; Owner: dev_user
--

ALTER SEQUENCE analytics.backlog_aktywnosci_id_seq OWNED BY analytics.activity_backlog.id;


--
-- TOC entry 233 (class 1259 OID 3451652)
-- Name: backlog_id_seq; Type: SEQUENCE; Schema: analytics; Owner: dev_user
--

CREATE SEQUENCE analytics.backlog_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 3205 (class 0 OID 0)
-- Dependencies: 233
-- Name: backlog_id_seq; Type: SEQUENCE OWNED BY; Schema: analytics; Owner: dev_user
--

ALTER SEQUENCE analytics.backlog_id_seq OWNED BY analytics.backlog.id;


--
-- TOC entry 210 (class 1259 OID 3451452)
-- Name: accounts; Type: TABLE; Schema: auth; Owner: dev_user
--

CREATE TABLE auth.accounts (
    id integer NOT NULL,
    user_id integer NOT NULL,
    organization_id integer NOT NULL,
    role character varying(50) NOT NULL
);



--
-- TOC entry 243 (class 1259 OID 3499179)
-- Name: avatars; Type: TABLE; Schema: auth; Owner: dev_user
--

CREATE TABLE auth.avatars (
    id integer NOT NULL,
    image_url character varying(255) NOT NULL,
    name character varying(100) NOT NULL
);



--
-- TOC entry 209 (class 1259 OID 3451450)
-- Name: konta_id_seq; Type: SEQUENCE; Schema: auth; Owner: dev_user
--

CREATE SEQUENCE auth.konta_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 3206 (class 0 OID 0)
-- Dependencies: 209
-- Name: konta_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: dev_user
--

ALTER SEQUENCE auth.konta_id_seq OWNED BY auth.accounts.id;


--
-- TOC entry 208 (class 1259 OID 3451444)
-- Name: organizations; Type: TABLE; Schema: auth; Owner: dev_user
--

CREATE TABLE auth.organizations (
    id integer NOT NULL,
    name character varying(255) NOT NULL
);



--
-- TOC entry 207 (class 1259 OID 3451442)
-- Name: organizacje_id_seq; Type: SEQUENCE; Schema: auth; Owner: dev_user
--

CREATE SEQUENCE auth.organizacje_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 3207 (class 0 OID 0)
-- Dependencies: 207
-- Name: organizacje_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: dev_user
--

ALTER SEQUENCE auth.organizacje_id_seq OWNED BY auth.organizations.id;


--
-- TOC entry 238 (class 1259 OID 3452874)
-- Name: tokens; Type: TABLE; Schema: auth; Owner: dev_user
--

CREATE TABLE auth.tokens (
    id integer NOT NULL,
    token_hmac character varying(256) NOT NULL,
    user_id integer NOT NULL,
    browser_uuid uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    expired_at timestamp with time zone NOT NULL
);



--
-- TOC entry 3208 (class 0 OID 0)
-- Dependencies: 238
-- Name: TABLE tokens; Type: COMMENT; Schema: auth; Owner: dev_user
--

COMMENT ON TABLE auth.tokens IS 'Table for storing user''s encrypted auth tokens.';


--
-- TOC entry 3209 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN tokens.id; Type: COMMENT; Schema: auth; Owner: dev_user
--

COMMENT ON COLUMN auth.tokens.id IS 'Id';


--
-- TOC entry 3210 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN tokens.token_hmac; Type: COMMENT; Schema: auth; Owner: dev_user
--

COMMENT ON COLUMN auth.tokens.token_hmac IS 'Hmac encrypted token';


--
-- TOC entry 3211 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN tokens.user_id; Type: COMMENT; Schema: auth; Owner: dev_user
--

COMMENT ON COLUMN auth.tokens.user_id IS 'User''s id';


--
-- TOC entry 3212 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN tokens.browser_uuid; Type: COMMENT; Schema: auth; Owner: dev_user
--

COMMENT ON COLUMN auth.tokens.browser_uuid IS 'User''s browser uuid';


--
-- TOC entry 3213 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN tokens.created_at; Type: COMMENT; Schema: auth; Owner: dev_user
--

COMMENT ON COLUMN auth.tokens.created_at IS 'Timestamp, when token is created';


--
-- TOC entry 3214 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN tokens.expired_at; Type: COMMENT; Schema: auth; Owner: dev_user
--

COMMENT ON COLUMN auth.tokens.expired_at IS 'Timestamp, when token will be expired';


--
-- TOC entry 237 (class 1259 OID 3452872)
-- Name: tokens_id_seq; Type: SEQUENCE; Schema: auth; Owner: dev_user
--

CREATE SEQUENCE auth.tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 3215 (class 0 OID 0)
-- Dependencies: 237
-- Name: tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: dev_user
--

ALTER SEQUENCE auth.tokens_id_seq OWNED BY auth.tokens.id;


--
-- TOC entry 206 (class 1259 OID 3451430)
-- Name: users; Type: TABLE; Schema: auth; Owner: dev_user
--

CREATE TABLE auth.users (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    student_id integer NOT NULL,
    name character varying(100) NOT NULL,
    surname character varying(100) NOT NULL,
    nickname character varying(100) NOT NULL,
    language character varying(10) DEFAULT 'PL'::character varying,
    avatar_id integer NOT NULL,
    registration_completed boolean NOT NULL DEFAULT false,
    eula_accepted_at timestamp without time zone DEFAULT NULL
);



--
-- TOC entry 205 (class 1259 OID 3451428)
-- Name: uzytkownicy_id_seq; Type: SEQUENCE; Schema: auth; Owner: dev_user
--

CREATE SEQUENCE auth.uzytkownicy_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 3216 (class 0 OID 0)
-- Dependencies: 205
-- Name: uzytkownicy_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: dev_user
--

ALTER SEQUENCE auth.uzytkownicy_id_seq OWNED BY auth.users.id;


--
-- TOC entry 218 (class 1259 OID 3451516)
-- Name: activities; Type: TABLE; Schema: education; Owner: dev_user
--

CREATE TABLE education.activities (
    id integer NOT NULL,
    stage_id integer,
    name character varying(255) NOT NULL,
    currency integer DEFAULT 0,
    educational_description text,
    story_description text
);



--
-- TOC entry 217 (class 1259 OID 3451514)
-- Name: aktywnosci_id_seq; Type: SEQUENCE; Schema: education; Owner: dev_user
--

CREATE SEQUENCE education.aktywnosci_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 3217 (class 0 OID 0)
-- Dependencies: 217
-- Name: aktywnosci_id_seq; Type: SEQUENCE OWNED BY; Schema: education; Owner: dev_user
--

ALTER SEQUENCE education.aktywnosci_id_seq OWNED BY education.activities.id;


--
-- TOC entry 216 (class 1259 OID 3451503)
-- Name: stages; Type: TABLE; Schema: education; Owner: dev_user
--

CREATE TABLE education.stages (
    id integer NOT NULL,
    group_id integer,
    name character varying(255) NOT NULL
);



--
-- TOC entry 215 (class 1259 OID 3451501)
-- Name: etapy_id_seq; Type: SEQUENCE; Schema: education; Owner: dev_user
--

CREATE SEQUENCE education.etapy_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 3218 (class 0 OID 0)
-- Dependencies: 215
-- Name: etapy_id_seq; Type: SEQUENCE OWNED BY; Schema: education; Owner: dev_user
--

ALTER SEQUENCE education.etapy_id_seq OWNED BY education.stages.id;


--
-- TOC entry 212 (class 1259 OID 3451470)
-- Name: groups; Type: TABLE; Schema: education; Owner: dev_user
--

CREATE TABLE education.groups (
    id integer NOT NULL,
    teacher_account_id integer NOT NULL,
    name character varying(255) NOT NULL,
    subject_name character varying(255),
    image_ref character varying(255),
    description text,
    currency character varying(100),
    currency_icon character varying(255),
    lives integer DEFAULT 3,
    lives_icon character varying(255),
    entry_code character varying(10)
);



--
-- TOC entry 211 (class 1259 OID 3451468)
-- Name: grupy_id_seq; Type: SEQUENCE; Schema: education; Owner: dev_user
--

CREATE SEQUENCE education.grupy_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 3219 (class 0 OID 0)
-- Dependencies: 211
-- Name: grupy_id_seq; Type: SEQUENCE OWNED BY; Schema: education; Owner: dev_user
--

ALTER SEQUENCE education.grupy_id_seq OWNED BY education.groups.id;


--
-- TOC entry 214 (class 1259 OID 3451487)
-- Name: posts; Type: TABLE; Schema: education; Owner: dev_user
--

CREATE TABLE education.posts (
    id integer NOT NULL,
    group_id integer,
    title character varying(255),
    content text
);



--
-- TOC entry 213 (class 1259 OID 3451485)
-- Name: wpisy_id_seq; Type: SEQUENCE; Schema: education; Owner: dev_user
--

CREATE SEQUENCE education.wpisy_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 3220 (class 0 OID 0)
-- Dependencies: 213
-- Name: wpisy_id_seq; Type: SEQUENCE OWNED BY; Schema: education; Owner: dev_user
--

ALTER SEQUENCE education.wpisy_id_seq OWNED BY education.posts.id;


--
-- TOC entry 226 (class 1259 OID 3451588)
-- Name: badges; Type: TABLE; Schema: gamification; Owner: dev_user
--

CREATE TABLE gamification.badges (
    id integer NOT NULL,
    group_id integer,
    name character varying(100) NOT NULL,
    educational_description text,
    icon character varying(255),
    story_description text,
    reward_amount integer DEFAULT 0,
    rarity character varying(20) DEFAULT 'common' NOT NULL
);



--
-- TOC entry 228 (class 1259 OID 3451604)
-- Name: earned_badges; Type: TABLE; Schema: gamification; Owner: dev_user
--

CREATE TABLE gamification.earned_badges (
    id integer NOT NULL,
    enrollment_id integer,
    badge_id integer
);



--
-- TOC entry 220 (class 1259 OID 3451533)
-- Name: enrollments; Type: TABLE; Schema: gamification; Owner: dev_user
--

CREATE TABLE gamification.enrollments (
    id integer NOT NULL,
    group_id integer NOT NULL,
    student_account_id integer NOT NULL
);



--
-- TOC entry 225 (class 1259 OID 3451586)
-- Name: odznaki_id_seq; Type: SEQUENCE; Schema: gamification; Owner: dev_user
--

CREATE SEQUENCE gamification.odznaki_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 3221 (class 0 OID 0)
-- Dependencies: 225
-- Name: odznaki_id_seq; Type: SEQUENCE OWNED BY; Schema: gamification; Owner: dev_user
--

ALTER SEQUENCE gamification.odznaki_id_seq OWNED BY gamification.badges.id;


--
-- TOC entry 230 (class 1259 OID 3451622)
-- Name: shop_items; Type: TABLE; Schema: gamification; Owner: dev_user
--

CREATE TABLE gamification.shop_items (
    id integer NOT NULL,
    group_id integer,
    price integer NOT NULL,
    quantity integer
);



--
-- TOC entry 229 (class 1259 OID 3451620)
-- Name: przedmioty_w_sklepie_id_seq; Type: SEQUENCE; Schema: gamification; Owner: dev_user
--

CREATE SEQUENCE gamification.przedmioty_w_sklepie_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 3222 (class 0 OID 0)
-- Dependencies: 229
-- Name: przedmioty_w_sklepie_id_seq; Type: SEQUENCE OWNED BY; Schema: gamification; Owner: dev_user
--

ALTER SEQUENCE gamification.przedmioty_w_sklepie_id_seq OWNED BY gamification.shop_items.id;


--
-- TOC entry 222 (class 1259 OID 3451553)
-- Name: ranks; Type: TABLE; Schema: gamification; Owner: dev_user
--

CREATE TABLE gamification.ranks (
    id integer NOT NULL,
    group_id integer,
    name character varying(100) NOT NULL,
    required_points integer NOT NULL,
    icon character varying(255),
    story_description text,
    store_discount integer DEFAULT 0,
    unique_store_items text[]
);



--
-- TOC entry 221 (class 1259 OID 3451551)
-- Name: rangi_id_seq; Type: SEQUENCE; Schema: gamification; Owner: dev_user
--

CREATE SEQUENCE gamification.rangi_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 3223 (class 0 OID 0)
-- Dependencies: 221
-- Name: rangi_id_seq; Type: SEQUENCE OWNED BY; Schema: gamification; Owner: dev_user
--

ALTER SEQUENCE gamification.rangi_id_seq OWNED BY gamification.ranks.id;


--
-- TOC entry 224 (class 1259 OID 3451566)
-- Name: student_stats; Type: TABLE; Schema: gamification; Owner: dev_user
--

CREATE TABLE gamification.student_stats (
    id integer NOT NULL,
    enrollment_id integer,
    currency integer DEFAULT 0,
    total_earned integer DEFAULT 0,
    rank_id integer
);



--
-- TOC entry 223 (class 1259 OID 3451564)
-- Name: statystyki_studenta_id_seq; Type: SEQUENCE; Schema: gamification; Owner: dev_user
--

CREATE SEQUENCE gamification.statystyki_studenta_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 3224 (class 0 OID 0)
-- Dependencies: 223
-- Name: statystyki_studenta_id_seq; Type: SEQUENCE OWNED BY; Schema: gamification; Owner: dev_user
--

ALTER SEQUENCE gamification.statystyki_studenta_id_seq OWNED BY gamification.student_stats.id;


--
-- TOC entry 232 (class 1259 OID 3451635)
-- Name: transactions; Type: TABLE; Schema: gamification; Owner: dev_user
--

CREATE TABLE gamification.transactions (
    id integer NOT NULL,
    enrollment_id integer,
    item_id integer,
    amount integer NOT NULL,
    purchase_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- TOC entry 231 (class 1259 OID 3451633)
-- Name: transakcje_id_seq; Type: SEQUENCE; Schema: gamification; Owner: dev_user
--

CREATE SEQUENCE gamification.transakcje_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 3225 (class 0 OID 0)
-- Dependencies: 231
-- Name: transakcje_id_seq; Type: SEQUENCE OWNED BY; Schema: gamification; Owner: dev_user
--

ALTER SEQUENCE gamification.transakcje_id_seq OWNED BY gamification.transactions.id;


--
-- TOC entry 219 (class 1259 OID 3451531)
-- Name: zapisy_id_seq; Type: SEQUENCE; Schema: gamification; Owner: dev_user
--

CREATE SEQUENCE gamification.zapisy_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 3226 (class 0 OID 0)
-- Dependencies: 219
-- Name: zapisy_id_seq; Type: SEQUENCE OWNED BY; Schema: gamification; Owner: dev_user
--

ALTER SEQUENCE gamification.zapisy_id_seq OWNED BY gamification.enrollments.id;


--
-- TOC entry 227 (class 1259 OID 3451602)
-- Name: zdobyte_odznaki_id_seq; Type: SEQUENCE; Schema: gamification; Owner: dev_user
--

CREATE SEQUENCE gamification.zdobyte_odznaki_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 3227 (class 0 OID 0)
-- Dependencies: 227
-- Name: zdobyte_odznaki_id_seq; Type: SEQUENCE OWNED BY; Schema: gamification; Owner: dev_user
--

ALTER SEQUENCE gamification.zdobyte_odznaki_id_seq OWNED BY gamification.earned_badges.id;


--
-- TOC entry 242 (class 1259 OID 3452999)
-- Name: drive; Type: TABLE; Schema: services; Owner: dev_user
--

CREATE TABLE services.drive (
    id integer NOT NULL,
    ref uuid NOT NULL,
    size integer NOT NULL,
    mime_type character varying(4) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    organization_id integer NOT NULL
);



--
-- TOC entry 3228 (class 0 OID 0)
-- Dependencies: 242
-- Name: TABLE drive; Type: COMMENT; Schema: services; Owner: dev_user
--

COMMENT ON TABLE services.drive IS 'Table for storing references of organization''s files.';


--
-- TOC entry 3229 (class 0 OID 0)
-- Dependencies: 242
-- Name: COLUMN drive.id; Type: COMMENT; Schema: services; Owner: dev_user
--

COMMENT ON COLUMN services.drive.id IS 'Reference id.';


--
-- TOC entry 3230 (class 0 OID 0)
-- Dependencies: 242
-- Name: COLUMN drive.ref; Type: COMMENT; Schema: services; Owner: dev_user
--

COMMENT ON COLUMN services.drive.ref IS 'Unique reference';


--
-- TOC entry 3231 (class 0 OID 0)
-- Dependencies: 242
-- Name: COLUMN drive.size; Type: COMMENT; Schema: services; Owner: dev_user
--

COMMENT ON COLUMN services.drive.size IS 'File''s size.';


--
-- TOC entry 3232 (class 0 OID 0)
-- Dependencies: 242
-- Name: COLUMN drive.mime_type; Type: COMMENT; Schema: services; Owner: dev_user
--

COMMENT ON COLUMN services.drive.mime_type IS 'Mime type.';


--
-- TOC entry 3233 (class 0 OID 0)
-- Dependencies: 242
-- Name: COLUMN drive.created_at; Type: COMMENT; Schema: services; Owner: dev_user
--

COMMENT ON COLUMN services.drive.created_at IS 'UTC+tz when file is created.';


--
-- TOC entry 3234 (class 0 OID 0)
-- Dependencies: 242
-- Name: COLUMN drive.organization_id; Type: COMMENT; Schema: services; Owner: dev_user
--

COMMENT ON COLUMN services.drive.organization_id IS 'Organization id, where stored.';


--
-- TOC entry 239 (class 1259 OID 3452993)
-- Name: drive_id_seq; Type: SEQUENCE; Schema: services; Owner: dev_user
--

CREATE SEQUENCE services.drive_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 3235 (class 0 OID 0)
-- Dependencies: 239
-- Name: drive_id_seq; Type: SEQUENCE OWNED BY; Schema: services; Owner: dev_user
--

ALTER SEQUENCE services.drive_id_seq OWNED BY services.drive.id;


--
-- TOC entry 241 (class 1259 OID 3452997)
-- Name: drive_organization_id_seq; Type: SEQUENCE; Schema: services; Owner: dev_user
--

CREATE SEQUENCE services.drive_organization_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 3236 (class 0 OID 0)
-- Dependencies: 241
-- Name: drive_organization_id_seq; Type: SEQUENCE OWNED BY; Schema: services; Owner: dev_user
--

ALTER SEQUENCE services.drive_organization_id_seq OWNED BY services.drive.organization_id;


--
-- TOC entry 240 (class 1259 OID 3452995)
-- Name: drive_size_seq; Type: SEQUENCE; Schema: services; Owner: dev_user
--

CREATE SEQUENCE services.drive_size_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 3237 (class 0 OID 0)
-- Dependencies: 240
-- Name: drive_size_seq; Type: SEQUENCE OWNED BY; Schema: services; Owner: dev_user
--

ALTER SEQUENCE services.drive_size_seq OWNED BY services.drive.size;


--
-- TOC entry 2951 (class 2604 OID 3451679)
-- Name: activity_backlog id; Type: DEFAULT; Schema: analytics; Owner: dev_user
--

ALTER TABLE ONLY analytics.activity_backlog ALTER COLUMN id SET DEFAULT nextval('analytics.backlog_aktywnosci_id_seq'::regclass);


--
-- TOC entry 2949 (class 2604 OID 3451657)
-- Name: backlog id; Type: DEFAULT; Schema: analytics; Owner: dev_user
--

ALTER TABLE ONLY analytics.backlog ALTER COLUMN id SET DEFAULT nextval('analytics.backlog_id_seq'::regclass);


--
-- TOC entry 2930 (class 2604 OID 3451455)
-- Name: accounts id; Type: DEFAULT; Schema: auth; Owner: dev_user
--

ALTER TABLE ONLY auth.accounts ALTER COLUMN id SET DEFAULT nextval('auth.konta_id_seq'::regclass);


--
-- TOC entry 2929 (class 2604 OID 3451447)
-- Name: organizations id; Type: DEFAULT; Schema: auth; Owner: dev_user
--

ALTER TABLE ONLY auth.organizations ALTER COLUMN id SET DEFAULT nextval('auth.organizacje_id_seq'::regclass);


--
-- TOC entry 2953 (class 2604 OID 3452877)
-- Name: tokens id; Type: DEFAULT; Schema: auth; Owner: dev_user
--

ALTER TABLE ONLY auth.tokens ALTER COLUMN id SET DEFAULT nextval('auth.tokens_id_seq'::regclass);


--
-- TOC entry 2927 (class 2604 OID 3451433)
-- Name: users id; Type: DEFAULT; Schema: auth; Owner: dev_user
--

ALTER TABLE ONLY auth.users ALTER COLUMN id SET DEFAULT nextval('auth.uzytkownicy_id_seq'::regclass);


--
-- TOC entry 2935 (class 2604 OID 3451519)
-- Name: activities id; Type: DEFAULT; Schema: education; Owner: dev_user
--

ALTER TABLE ONLY education.activities ALTER COLUMN id SET DEFAULT nextval('education.aktywnosci_id_seq'::regclass);


--
-- TOC entry 2931 (class 2604 OID 3451473)
-- Name: groups id; Type: DEFAULT; Schema: education; Owner: dev_user
--

ALTER TABLE ONLY education.groups ALTER COLUMN id SET DEFAULT nextval('education.grupy_id_seq'::regclass);


--
-- TOC entry 2933 (class 2604 OID 3451490)
-- Name: posts id; Type: DEFAULT; Schema: education; Owner: dev_user
--

ALTER TABLE ONLY education.posts ALTER COLUMN id SET DEFAULT nextval('education.wpisy_id_seq'::regclass);


--
-- TOC entry 2934 (class 2604 OID 3451506)
-- Name: stages id; Type: DEFAULT; Schema: education; Owner: dev_user
--

ALTER TABLE ONLY education.stages ALTER COLUMN id SET DEFAULT nextval('education.etapy_id_seq'::regclass);


--
-- TOC entry 2943 (class 2604 OID 3451591)
-- Name: badges id; Type: DEFAULT; Schema: gamification; Owner: dev_user
--

ALTER TABLE ONLY gamification.badges ALTER COLUMN id SET DEFAULT nextval('gamification.odznaki_id_seq'::regclass);


--
-- TOC entry 2945 (class 2604 OID 3451607)
-- Name: earned_badges id; Type: DEFAULT; Schema: gamification; Owner: dev_user
--

ALTER TABLE ONLY gamification.earned_badges ALTER COLUMN id SET DEFAULT nextval('gamification.zdobyte_odznaki_id_seq'::regclass);


--
-- TOC entry 2937 (class 2604 OID 3451536)
-- Name: enrollments id; Type: DEFAULT; Schema: gamification; Owner: dev_user
--

ALTER TABLE ONLY gamification.enrollments ALTER COLUMN id SET DEFAULT nextval('gamification.zapisy_id_seq'::regclass);


--
-- TOC entry 2938 (class 2604 OID 3451556)
-- Name: ranks id; Type: DEFAULT; Schema: gamification; Owner: dev_user
--

ALTER TABLE ONLY gamification.ranks ALTER COLUMN id SET DEFAULT nextval('gamification.rangi_id_seq'::regclass);


--
-- TOC entry 2946 (class 2604 OID 3451625)
-- Name: shop_items id; Type: DEFAULT; Schema: gamification; Owner: dev_user
--

ALTER TABLE ONLY gamification.shop_items ALTER COLUMN id SET DEFAULT nextval('gamification.przedmioty_w_sklepie_id_seq'::regclass);


--
-- TOC entry 2940 (class 2604 OID 3451569)
-- Name: student_stats id; Type: DEFAULT; Schema: gamification; Owner: dev_user
--

ALTER TABLE ONLY gamification.student_stats ALTER COLUMN id SET DEFAULT nextval('gamification.statystyki_studenta_id_seq'::regclass);


--
-- TOC entry 2947 (class 2604 OID 3451638)
-- Name: transactions id; Type: DEFAULT; Schema: gamification; Owner: dev_user
--

ALTER TABLE ONLY gamification.transactions ALTER COLUMN id SET DEFAULT nextval('gamification.transakcje_id_seq'::regclass);


--
-- TOC entry 2954 (class 2604 OID 3453002)
-- Name: drive id; Type: DEFAULT; Schema: services; Owner: dev_user
--

ALTER TABLE ONLY services.drive ALTER COLUMN id SET DEFAULT nextval('services.drive_id_seq'::regclass);


--
-- TOC entry 3189 (class 0 OID 3451676)
-- Dependencies: 236
-- Data for Name: activity_backlog; Type: TABLE DATA; Schema: analytics; Owner: dev_user
--

COPY analytics.activity_backlog (id, group_id, activity_id, account_id, date) FROM stdin;
\.


--
-- TOC entry 3187 (class 0 OID 3451654)
-- Dependencies: 234
-- Data for Name: backlog; Type: TABLE DATA; Schema: analytics; Owner: dev_user
--

COPY analytics.backlog (id, group_id, account_id, type, date, value) FROM stdin;
\.


--
-- TOC entry 3163 (class 0 OID 3451452)
-- Dependencies: 210
-- Data for Name: accounts; Type: TABLE DATA; Schema: auth; Owner: dev_user
--

COPY auth.accounts (id, user_id, organization_id, role) FROM stdin;
\.


--
-- TOC entry 3196 (class 0 OID 3499179)
-- Dependencies: 243
-- Data for Name: avatars; Type: TABLE DATA; Schema: auth; Owner: dev_user
--

COPY auth.avatars (id, image_url, name) FROM stdin;
1	https://api.dicebear.com/7.x/bottts/svg?seed=BlueRobot	Niebieski Robot
2	https://api.dicebear.com/7.x/bottts/svg?seed=GreenRobot	Zielony Robot
3	https://api.dicebear.com/7.x/bottts/svg?seed=RedGnom	Czerwony Gnom
4	https://api.dicebear.com/7.x/bottts/svg?seed=GoldenCat	Złoty Kot
5	https://api.dicebear.com/7.x/bottts/svg?seed=WiseOwl	Mądra Sowa
6	https://api.dicebear.com/7.x/bottts/svg?seed=AstroDog	Kosmiczny Pies
\.


--
-- TOC entry 3161 (class 0 OID 3451444)
-- Dependencies: 208
-- Data for Name: organizations; Type: TABLE DATA; Schema: auth; Owner: dev_user
--

COPY auth.organizations (id, name) FROM stdin;
\.


--
-- TOC entry 3191 (class 0 OID 3452874)
-- Dependencies: 238
-- Data for Name: tokens; Type: TABLE DATA; Schema: auth; Owner: dev_user
--

COPY auth.tokens (id, token_hmac, user_id, browser_uuid, created_at, expired_at) FROM stdin;
\.


--
-- TOC entry 3159 (class 0 OID 3451430)
-- Dependencies: 206
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: dev_user
--

COPY auth.users (id, email, student_id, name, surname, nickname, language, avatar_id) FROM stdin;
\.


--
-- TOC entry 3171 (class 0 OID 3451516)
-- Dependencies: 218
-- Data for Name: activities; Type: TABLE DATA; Schema: education; Owner: dev_user
--

COPY education.activities (id, stage_id, name, currency, educational_description, story_description) FROM stdin;
\.


--
-- TOC entry 3165 (class 0 OID 3451470)
-- Dependencies: 212
-- Data for Name: groups; Type: TABLE DATA; Schema: education; Owner: dev_user
--

COPY education.groups (id, teacher_account_id, name, subject_name, image_ref, description, currency, currency_icon, lives, lives_icon, entry_code) FROM stdin;
\.


--
-- TOC entry 3167 (class 0 OID 3451487)
-- Dependencies: 214
-- Data for Name: posts; Type: TABLE DATA; Schema: education; Owner: dev_user
--

COPY education.posts (id, group_id, title, content) FROM stdin;
\.


--
-- TOC entry 3169 (class 0 OID 3451503)
-- Dependencies: 216
-- Data for Name: stages; Type: TABLE DATA; Schema: education; Owner: dev_user
--

COPY education.stages (id, group_id, name) FROM stdin;
\.


--
-- TOC entry 3179 (class 0 OID 3451588)
-- Dependencies: 226
-- Data for Name: badges; Type: TABLE DATA; Schema: gamification; Owner: dev_user
--

COPY gamification.badges (id, group_id, name, educational_description, icon, story_description, reward_amount, rarity) FROM stdin;
\.


--
-- TOC entry 3181 (class 0 OID 3451604)
-- Dependencies: 228
-- Data for Name: earned_badges; Type: TABLE DATA; Schema: gamification; Owner: dev_user
--

COPY gamification.earned_badges (id, enrollment_id, badge_id) FROM stdin;
\.


--
-- TOC entry 3173 (class 0 OID 3451533)
-- Dependencies: 220
-- Data for Name: enrollments; Type: TABLE DATA; Schema: gamification; Owner: dev_user
--

COPY gamification.enrollments (id, group_id, student_account_id) FROM stdin;
\.


--
-- TOC entry 3175 (class 0 OID 3451553)
-- Dependencies: 222
-- Data for Name: ranks; Type: TABLE DATA; Schema: gamification; Owner: dev_user
--

COPY gamification.ranks (id, group_id, name, required_points, icon, story_description, store_discount, unique_store_items) FROM stdin;
\.


--
-- TOC entry 3183 (class 0 OID 3451622)
-- Dependencies: 230
-- Data for Name: shop_items; Type: TABLE DATA; Schema: gamification; Owner: dev_user
--

COPY gamification.shop_items (id, group_id, price, quantity) FROM stdin;
\.


--
-- TOC entry 3177 (class 0 OID 3451566)
-- Dependencies: 224
-- Data for Name: student_stats; Type: TABLE DATA; Schema: gamification; Owner: dev_user
--

COPY gamification.student_stats (id, enrollment_id, currency, total_earned, rank_id) FROM stdin;
\.


--
-- TOC entry 3185 (class 0 OID 3451635)
-- Dependencies: 232
-- Data for Name: transactions; Type: TABLE DATA; Schema: gamification; Owner: dev_user
--

COPY gamification.transactions (id, enrollment_id, item_id, amount, purchase_date) FROM stdin;
\.


--
-- TOC entry 3195 (class 0 OID 3452999)
-- Dependencies: 242
-- Data for Name: drive; Type: TABLE DATA; Schema: services; Owner: dev_user
--

COPY services.drive (id, ref, size, mime_type, created_at, organization_id) FROM stdin;
\.


--
-- TOC entry 3238 (class 0 OID 0)
-- Dependencies: 235
-- Name: backlog_aktywnosci_id_seq; Type: SEQUENCE SET; Schema: analytics; Owner: dev_user
--

SELECT pg_catalog.setval('analytics.backlog_aktywnosci_id_seq', 1, false);


--
-- TOC entry 3239 (class 0 OID 0)
-- Dependencies: 233
-- Name: backlog_id_seq; Type: SEQUENCE SET; Schema: analytics; Owner: dev_user
--

SELECT pg_catalog.setval('analytics.backlog_id_seq', 1, false);


--
-- TOC entry 3240 (class 0 OID 0)
-- Dependencies: 209
-- Name: konta_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: dev_user
--

SELECT pg_catalog.setval('auth.konta_id_seq', 1, false);


--
-- TOC entry 3241 (class 0 OID 0)
-- Dependencies: 207
-- Name: organizacje_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: dev_user
--

SELECT pg_catalog.setval('auth.organizacje_id_seq', 1, false);


--
-- TOC entry 3242 (class 0 OID 0)
-- Dependencies: 237
-- Name: tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: dev_user
--

SELECT pg_catalog.setval('auth.tokens_id_seq', 1, false);


--
-- TOC entry 3243 (class 0 OID 0)
-- Dependencies: 205
-- Name: uzytkownicy_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: dev_user
--

SELECT pg_catalog.setval('auth.uzytkownicy_id_seq', 1, false);


--
-- TOC entry 3244 (class 0 OID 0)
-- Dependencies: 217
-- Name: aktywnosci_id_seq; Type: SEQUENCE SET; Schema: education; Owner: dev_user
--

SELECT pg_catalog.setval('education.aktywnosci_id_seq', 1, false);


--
-- TOC entry 3245 (class 0 OID 0)
-- Dependencies: 215
-- Name: etapy_id_seq; Type: SEQUENCE SET; Schema: education; Owner: dev_user
--

SELECT pg_catalog.setval('education.etapy_id_seq', 1, false);


--
-- TOC entry 3246 (class 0 OID 0)
-- Dependencies: 211
-- Name: grupy_id_seq; Type: SEQUENCE SET; Schema: education; Owner: dev_user
--

SELECT pg_catalog.setval('education.grupy_id_seq', 1, false);


--
-- TOC entry 3247 (class 0 OID 0)
-- Dependencies: 213
-- Name: wpisy_id_seq; Type: SEQUENCE SET; Schema: education; Owner: dev_user
--

SELECT pg_catalog.setval('education.wpisy_id_seq', 1, false);


--
-- TOC entry 3248 (class 0 OID 0)
-- Dependencies: 225
-- Name: odznaki_id_seq; Type: SEQUENCE SET; Schema: gamification; Owner: dev_user
--

SELECT pg_catalog.setval('gamification.odznaki_id_seq', 1, false);


--
-- TOC entry 3249 (class 0 OID 0)
-- Dependencies: 229
-- Name: przedmioty_w_sklepie_id_seq; Type: SEQUENCE SET; Schema: gamification; Owner: dev_user
--

SELECT pg_catalog.setval('gamification.przedmioty_w_sklepie_id_seq', 1, false);


--
-- TOC entry 3250 (class 0 OID 0)
-- Dependencies: 221
-- Name: rangi_id_seq; Type: SEQUENCE SET; Schema: gamification; Owner: dev_user
--

SELECT pg_catalog.setval('gamification.rangi_id_seq', 1, false);


--
-- TOC entry 3251 (class 0 OID 0)
-- Dependencies: 223
-- Name: statystyki_studenta_id_seq; Type: SEQUENCE SET; Schema: gamification; Owner: dev_user
--

SELECT pg_catalog.setval('gamification.statystyki_studenta_id_seq', 1, false);


--
-- TOC entry 3252 (class 0 OID 0)
-- Dependencies: 231
-- Name: transakcje_id_seq; Type: SEQUENCE SET; Schema: gamification; Owner: dev_user
--

SELECT pg_catalog.setval('gamification.transakcje_id_seq', 1, false);


--
-- TOC entry 3253 (class 0 OID 0)
-- Dependencies: 219
-- Name: zapisy_id_seq; Type: SEQUENCE SET; Schema: gamification; Owner: dev_user
--

SELECT pg_catalog.setval('gamification.zapisy_id_seq', 1, false);


--
-- TOC entry 3254 (class 0 OID 0)
-- Dependencies: 227
-- Name: zdobyte_odznaki_id_seq; Type: SEQUENCE SET; Schema: gamification; Owner: dev_user
--

SELECT pg_catalog.setval('gamification.zdobyte_odznaki_id_seq', 1, false);


--
-- TOC entry 3255 (class 0 OID 0)
-- Dependencies: 239
-- Name: drive_id_seq; Type: SEQUENCE SET; Schema: services; Owner: dev_user
--

SELECT pg_catalog.setval('services.drive_id_seq', 1, false);


--
-- TOC entry 3256 (class 0 OID 0)
-- Dependencies: 241
-- Name: drive_organization_id_seq; Type: SEQUENCE SET; Schema: services; Owner: dev_user
--

SELECT pg_catalog.setval('services.drive_organization_id_seq', 1, false);


--
-- TOC entry 3257 (class 0 OID 0)
-- Dependencies: 240
-- Name: drive_size_seq; Type: SEQUENCE SET; Schema: services; Owner: dev_user
--

SELECT pg_catalog.setval('services.drive_size_seq', 1, false);


--
-- TOC entry 2992 (class 2606 OID 3451682)
-- Name: activity_backlog backlog_aktywnosci_pkey; Type: CONSTRAINT; Schema: analytics; Owner: dev_user
--

ALTER TABLE ONLY analytics.activity_backlog
    ADD CONSTRAINT backlog_aktywnosci_pkey PRIMARY KEY (id);


--
-- TOC entry 2990 (class 2606 OID 3451663)
-- Name: backlog backlog_pkey; Type: CONSTRAINT; Schema: analytics; Owner: dev_user
--

ALTER TABLE ONLY analytics.backlog
    ADD CONSTRAINT backlog_pkey PRIMARY KEY (id);


--
-- TOC entry 3002 (class 2606 OID 3499183)
-- Name: avatars avatars_pkey; Type: CONSTRAINT; Schema: auth; Owner: dev_user
--

ALTER TABLE ONLY auth.avatars
    ADD CONSTRAINT avatars_pkey PRIMARY KEY (id);


--
-- TOC entry 2962 (class 2606 OID 3451457)
-- Name: accounts konta_pkey; Type: CONSTRAINT; Schema: auth; Owner: dev_user
--

ALTER TABLE ONLY auth.accounts
    ADD CONSTRAINT konta_pkey PRIMARY KEY (id);


--
-- TOC entry 2960 (class 2606 OID 3451449)
-- Name: organizations organizacje_pkey; Type: CONSTRAINT; Schema: auth; Owner: dev_user
--

ALTER TABLE ONLY auth.organizations
    ADD CONSTRAINT organizacje_pkey PRIMARY KEY (id);


--
-- TOC entry 2994 (class 2606 OID 3452879)
-- Name: tokens tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: dev_user
--

ALTER TABLE ONLY auth.tokens
    ADD CONSTRAINT tokens_pkey PRIMARY KEY (id);


--
-- TOC entry 2996 (class 2606 OID 3452881)
-- Name: tokens tokens_token_hmac_key; Type: CONSTRAINT; Schema: auth; Owner: dev_user
--

ALTER TABLE ONLY auth.tokens
    ADD CONSTRAINT tokens_token_hmac_key UNIQUE (token_hmac);


--
-- TOC entry 2956 (class 2606 OID 3451441)
-- Name: users uzytkownicy_email_key; Type: CONSTRAINT; Schema: auth; Owner: dev_user
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT uzytkownicy_email_key UNIQUE (email);


--
-- TOC entry 2958 (class 2606 OID 3451439)
-- Name: users uzytkownicy_pkey; Type: CONSTRAINT; Schema: auth; Owner: dev_user
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT uzytkownicy_pkey PRIMARY KEY (id);


--
-- TOC entry 2970 (class 2606 OID 3451525)
-- Name: activities aktywnosci_pkey; Type: CONSTRAINT; Schema: education; Owner: dev_user
--

ALTER TABLE ONLY education.activities
    ADD CONSTRAINT aktywnosci_pkey PRIMARY KEY (id);


--
-- TOC entry 2968 (class 2606 OID 3451508)
-- Name: stages etapy_pkey; Type: CONSTRAINT; Schema: education; Owner: dev_user
--

ALTER TABLE ONLY education.stages
    ADD CONSTRAINT etapy_pkey PRIMARY KEY (id);


--
-- TOC entry 2964 (class 2606 OID 3451479)
-- Name: groups grupy_pkey; Type: CONSTRAINT; Schema: education; Owner: dev_user
--

ALTER TABLE ONLY education.groups
    ADD CONSTRAINT grupy_pkey PRIMARY KEY (id);


--
-- TOC entry 2966 (class 2606 OID 3451495)
-- Name: posts wpisy_pkey; Type: CONSTRAINT; Schema: education; Owner: dev_user
--

ALTER TABLE ONLY education.posts
    ADD CONSTRAINT wpisy_pkey PRIMARY KEY (id);


--
-- TOC entry 2982 (class 2606 OID 3451596)
-- Name: badges odznaki_pkey; Type: CONSTRAINT; Schema: gamification; Owner: dev_user
--

ALTER TABLE ONLY gamification.badges
    ADD CONSTRAINT odznaki_pkey PRIMARY KEY (id);


--
-- TOC entry 2986 (class 2606 OID 3451627)
-- Name: shop_items przedmioty_w_sklepie_pkey; Type: CONSTRAINT; Schema: gamification; Owner: dev_user
--

ALTER TABLE ONLY gamification.shop_items
    ADD CONSTRAINT przedmioty_w_sklepie_pkey PRIMARY KEY (id);


--
-- TOC entry 2976 (class 2606 OID 3451558)
-- Name: ranks rangi_pkey; Type: CONSTRAINT; Schema: gamification; Owner: dev_user
--

ALTER TABLE ONLY gamification.ranks
    ADD CONSTRAINT rangi_pkey PRIMARY KEY (id);


--
-- TOC entry 2978 (class 2606 OID 3451575)
-- Name: student_stats statystyki_studenta_id_zapisu_key; Type: CONSTRAINT; Schema: gamification; Owner: dev_user
--

ALTER TABLE ONLY gamification.student_stats
    ADD CONSTRAINT statystyki_studenta_id_zapisu_key UNIQUE (enrollment_id);


--
-- TOC entry 2980 (class 2606 OID 3451573)
-- Name: student_stats statystyki_studenta_pkey; Type: CONSTRAINT; Schema: gamification; Owner: dev_user
--

ALTER TABLE ONLY gamification.student_stats
    ADD CONSTRAINT statystyki_studenta_pkey PRIMARY KEY (id);


--
-- TOC entry 2988 (class 2606 OID 3451641)
-- Name: transactions transakcje_pkey; Type: CONSTRAINT; Schema: gamification; Owner: dev_user
--

ALTER TABLE ONLY gamification.transactions
    ADD CONSTRAINT transakcje_pkey PRIMARY KEY (id);


--
-- TOC entry 2972 (class 2606 OID 3451540)
-- Name: enrollments zapisy_id_grupy_id_konta_studenta_key; Type: CONSTRAINT; Schema: gamification; Owner: dev_user
--

ALTER TABLE ONLY gamification.enrollments
    ADD CONSTRAINT zapisy_id_grupy_id_konta_studenta_key UNIQUE (group_id, student_account_id);


--
-- TOC entry 2974 (class 2606 OID 3451538)
-- Name: enrollments zapisy_pkey; Type: CONSTRAINT; Schema: gamification; Owner: dev_user
--

ALTER TABLE ONLY gamification.enrollments
    ADD CONSTRAINT zapisy_pkey PRIMARY KEY (id);


--
-- TOC entry 2984 (class 2606 OID 3451609)
-- Name: earned_badges zdobyte_odznaki_pkey; Type: CONSTRAINT; Schema: gamification; Owner: dev_user
--

ALTER TABLE ONLY gamification.earned_badges
    ADD CONSTRAINT zdobyte_odznaki_pkey PRIMARY KEY (id);


--
-- TOC entry 2998 (class 2606 OID 3453006)
-- Name: drive drive_pkey; Type: CONSTRAINT; Schema: services; Owner: dev_user
--

ALTER TABLE ONLY services.drive
    ADD CONSTRAINT drive_pkey PRIMARY KEY (id);


--
-- TOC entry 3000 (class 2606 OID 3453008)
-- Name: drive drive_ref_key; Type: CONSTRAINT; Schema: services; Owner: dev_user
--

ALTER TABLE ONLY services.drive
    ADD CONSTRAINT drive_ref_key UNIQUE (ref);


--
-- TOC entry 3023 (class 2606 OID 3451688)
-- Name: activity_backlog backlog_aktywnosci_id_aktywnosci_fkey; Type: FK CONSTRAINT; Schema: analytics; Owner: dev_user
--

ALTER TABLE ONLY analytics.activity_backlog
    ADD CONSTRAINT backlog_aktywnosci_id_aktywnosci_fkey FOREIGN KEY (activity_id) REFERENCES education.activities(id);


--
-- TOC entry 3024 (class 2606 OID 3451683)
-- Name: activity_backlog backlog_aktywnosci_id_grupy_fkey; Type: FK CONSTRAINT; Schema: analytics; Owner: dev_user
--

ALTER TABLE ONLY analytics.activity_backlog
    ADD CONSTRAINT backlog_aktywnosci_id_grupy_fkey FOREIGN KEY (group_id) REFERENCES education.groups(id);


--
-- TOC entry 3025 (class 2606 OID 3451693)
-- Name: activity_backlog backlog_aktywnosci_id_konta_fkey; Type: FK CONSTRAINT; Schema: analytics; Owner: dev_user
--

ALTER TABLE ONLY analytics.activity_backlog
    ADD CONSTRAINT backlog_aktywnosci_id_konta_fkey FOREIGN KEY (account_id) REFERENCES auth.accounts(id);


--
-- TOC entry 3021 (class 2606 OID 3451664)
-- Name: backlog backlog_id_grupy_fkey; Type: FK CONSTRAINT; Schema: analytics; Owner: dev_user
--

ALTER TABLE ONLY analytics.backlog
    ADD CONSTRAINT backlog_id_grupy_fkey FOREIGN KEY (group_id) REFERENCES education.groups(id);


--
-- TOC entry 3022 (class 2606 OID 3451669)
-- Name: backlog backlog_id_konta_fkey; Type: FK CONSTRAINT; Schema: analytics; Owner: dev_user
--

ALTER TABLE ONLY analytics.backlog
    ADD CONSTRAINT backlog_id_konta_fkey FOREIGN KEY (account_id) REFERENCES auth.accounts(id);


--
-- TOC entry 3003 (class 2606 OID 3499190)
-- Name: users fk_users_avatar; Type: FK CONSTRAINT; Schema: auth; Owner: dev_user
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT fk_users_avatar FOREIGN KEY (avatar_id) REFERENCES auth.avatars(id);


--
-- TOC entry 3004 (class 2606 OID 3451463)
-- Name: accounts konta_id_organizacji_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: dev_user
--

ALTER TABLE ONLY auth.accounts
    ADD CONSTRAINT konta_id_organizacji_fkey FOREIGN KEY (organization_id) REFERENCES auth.organizations(id);


--
-- TOC entry 3005 (class 2606 OID 3451458)
-- Name: accounts konta_id_uzytkownika_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: dev_user
--

ALTER TABLE ONLY auth.accounts
    ADD CONSTRAINT konta_id_uzytkownika_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- TOC entry 3026 (class 2606 OID 3452915)
-- Name: tokens userId; Type: FK CONSTRAINT; Schema: auth; Owner: dev_user
--

ALTER TABLE ONLY auth.tokens
    ADD CONSTRAINT "userId" FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- TOC entry 3009 (class 2606 OID 3451526)
-- Name: activities aktywnosci_id_etapu_fkey; Type: FK CONSTRAINT; Schema: education; Owner: dev_user
--

ALTER TABLE ONLY education.activities
    ADD CONSTRAINT aktywnosci_id_etapu_fkey FOREIGN KEY (stage_id) REFERENCES education.stages(id);


--
-- TOC entry 3008 (class 2606 OID 3451509)
-- Name: stages etapy_id_grupy_fkey; Type: FK CONSTRAINT; Schema: education; Owner: dev_user
--

ALTER TABLE ONLY education.stages
    ADD CONSTRAINT etapy_id_grupy_fkey FOREIGN KEY (group_id) REFERENCES education.groups(id);


--
-- TOC entry 3006 (class 2606 OID 3451480)
-- Name: groups grupy_id_konta_prowadzacego_fkey; Type: FK CONSTRAINT; Schema: education; Owner: dev_user
--

ALTER TABLE ONLY education.groups
    ADD CONSTRAINT grupy_id_konta_prowadzacego_fkey FOREIGN KEY (teacher_account_id) REFERENCES auth.accounts(id);


--
-- TOC entry 3007 (class 2606 OID 3451496)
-- Name: posts wpisy_id_grupy_fkey; Type: FK CONSTRAINT; Schema: education; Owner: dev_user
--

ALTER TABLE ONLY education.posts
    ADD CONSTRAINT wpisy_id_grupy_fkey FOREIGN KEY (group_id) REFERENCES education.groups(id);


--
-- TOC entry 3015 (class 2606 OID 3451597)
-- Name: badges odznaki_id_grupy_fkey; Type: FK CONSTRAINT; Schema: gamification; Owner: dev_user
--

ALTER TABLE ONLY gamification.badges
    ADD CONSTRAINT odznaki_id_grupy_fkey FOREIGN KEY (group_id) REFERENCES education.groups(id);


--
-- TOC entry 3018 (class 2606 OID 3451628)
-- Name: shop_items przedmioty_w_sklepie_id_grupy_fkey; Type: FK CONSTRAINT; Schema: gamification; Owner: dev_user
--

ALTER TABLE ONLY gamification.shop_items
    ADD CONSTRAINT przedmioty_w_sklepie_id_grupy_fkey FOREIGN KEY (group_id) REFERENCES education.groups(id);


--
-- TOC entry 3012 (class 2606 OID 3451559)
-- Name: ranks rangi_id_grupy_fkey; Type: FK CONSTRAINT; Schema: gamification; Owner: dev_user
--

ALTER TABLE ONLY gamification.ranks
    ADD CONSTRAINT rangi_id_grupy_fkey FOREIGN KEY (group_id) REFERENCES education.groups(id);


--
-- TOC entry 3013 (class 2606 OID 3451581)
-- Name: student_stats statystyki_studenta_id_rangi_fkey; Type: FK CONSTRAINT; Schema: gamification; Owner: dev_user
--

ALTER TABLE ONLY gamification.student_stats
    ADD CONSTRAINT statystyki_studenta_id_rangi_fkey FOREIGN KEY (rank_id) REFERENCES gamification.ranks(id);


--
-- TOC entry 3014 (class 2606 OID 3451576)
-- Name: student_stats statystyki_studenta_id_zapisu_fkey; Type: FK CONSTRAINT; Schema: gamification; Owner: dev_user
--

ALTER TABLE ONLY gamification.student_stats
    ADD CONSTRAINT statystyki_studenta_id_zapisu_fkey FOREIGN KEY (enrollment_id) REFERENCES gamification.enrollments(id);


--
-- TOC entry 3019 (class 2606 OID 3451647)
-- Name: transactions transakcje_id_przedmiotu_fkey; Type: FK CONSTRAINT; Schema: gamification; Owner: dev_user
--

ALTER TABLE ONLY gamification.transactions
    ADD CONSTRAINT transakcje_id_przedmiotu_fkey FOREIGN KEY (item_id) REFERENCES gamification.shop_items(id);


--
-- TOC entry 3020 (class 2606 OID 3451642)
-- Name: transactions transakcje_id_zapisu_fkey; Type: FK CONSTRAINT; Schema: gamification; Owner: dev_user
--

ALTER TABLE ONLY gamification.transactions
    ADD CONSTRAINT transakcje_id_zapisu_fkey FOREIGN KEY (enrollment_id) REFERENCES gamification.enrollments(id);


--
-- TOC entry 3010 (class 2606 OID 3451541)
-- Name: enrollments zapisy_id_grupy_fkey; Type: FK CONSTRAINT; Schema: gamification; Owner: dev_user
--

ALTER TABLE ONLY gamification.enrollments
    ADD CONSTRAINT zapisy_id_grupy_fkey FOREIGN KEY (group_id) REFERENCES education.groups(id);


--
-- TOC entry 3011 (class 2606 OID 3451546)
-- Name: enrollments zapisy_id_konta_studenta_fkey; Type: FK CONSTRAINT; Schema: gamification; Owner: dev_user
--

ALTER TABLE ONLY gamification.enrollments
    ADD CONSTRAINT zapisy_id_konta_studenta_fkey FOREIGN KEY (student_account_id) REFERENCES auth.accounts(id);


--
-- TOC entry 3016 (class 2606 OID 3451615)
-- Name: earned_badges zdobyte_odznaki_id_odznaki_fkey; Type: FK CONSTRAINT; Schema: gamification; Owner: dev_user
--

ALTER TABLE ONLY gamification.earned_badges
    ADD CONSTRAINT zdobyte_odznaki_id_odznaki_fkey FOREIGN KEY (badge_id) REFERENCES gamification.badges(id);


--
-- TOC entry 3017 (class 2606 OID 3451610)
-- Name: earned_badges zdobyte_odznaki_id_zapisu_fkey; Type: FK CONSTRAINT; Schema: gamification; Owner: dev_user
--

ALTER TABLE ONLY gamification.earned_badges
    ADD CONSTRAINT zdobyte_odznaki_id_zapisu_fkey FOREIGN KEY (enrollment_id) REFERENCES gamification.enrollments(id);


--
-- TOC entry 3027 (class 2606 OID 3453012)
-- Name: drive organization_id; Type: FK CONSTRAINT; Schema: services; Owner: dev_user
--

ALTER TABLE ONLY services.drive
    ADD CONSTRAINT organization_id FOREIGN KEY (organization_id) REFERENCES auth.organizations(id);


--
-- TOC entry 3202 (class 0 OID 0)
-- Dependencies: 5
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO PUBLIC;


-- Completed on 2026-05-24 18:40:09

--
-- PostgreSQL database dump complete
--

-- -- \unrestrict jnHGhu95iOvFKo4xTTbjM1b1ShkIN7TSnwGo8gb7bnC1kywpyVtqVSUIcTZ961w


