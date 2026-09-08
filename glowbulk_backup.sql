--
-- PostgreSQL database dump
--

\restrict smp5pCe1EpZca50dnCteMnj4FBJnX5QVhFM6utXdAucDZb66FxVdrOhzy1PxnC1

-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id integer NOT NULL,
    user_id integer,
    action character varying(100) NOT NULL,
    entity character varying(100) NOT NULL,
    entity_id integer,
    old_values jsonb,
    new_values jsonb,
    ip_address character varying(50),
    user_agent text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.audit_logs_id_seq OWNER TO postgres;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: content; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.content (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    content_type character varying(50) NOT NULL,
    content text NOT NULL,
    slug character varying(255) NOT NULL,
    meta_description text,
    status character varying(50) DEFAULT 'draft'::character varying,
    published_at timestamp without time zone,
    published_by integer,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.content OWNER TO postgres;

--
-- Name: content_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.content_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.content_id_seq OWNER TO postgres;

--
-- Name: content_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.content_id_seq OWNED BY public.content.id;


--
-- Name: customers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customers (
    id integer NOT NULL,
    user_id integer,
    company_name character varying(255) NOT NULL,
    company_registration character varying(100),
    billing_address text,
    billing_city character varying(100),
    billing_state character varying(100),
    billing_country character varying(100),
    billing_postal_code character varying(50),
    delivery_address text,
    delivery_city character varying(100),
    delivery_state character varying(100),
    delivery_country character varying(100),
    delivery_postal_code character varying(50),
    tax_number character varying(100),
    industry character varying(100),
    contact_person_name character varying(100),
    contact_person_email character varying(255),
    contact_person_phone character varying(50),
    preferred_fuel_types text[],
    status character varying(50) DEFAULT 'pending'::character varying,
    credit_limit numeric(15,2) DEFAULT 0,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.customers OWNER TO postgres;

--
-- Name: customers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.customers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.customers_id_seq OWNER TO postgres;

--
-- Name: customers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.customers_id_seq OWNED BY public.customers.id;


--
-- Name: fuel_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fuel_requests (
    id integer NOT NULL,
    customer_id integer,
    fuel_type character varying(50) NOT NULL,
    quantity numeric(15,2) NOT NULL,
    unit character varying(20) DEFAULT 'Liters'::character varying,
    delivery_address text,
    delivery_city character varying(100),
    delivery_state character varying(100),
    delivery_country character varying(100),
    delivery_postal_code character varying(50),
    preferred_delivery_date date,
    preferred_delivery_time character varying(50),
    special_instructions text,
    status character varying(50) DEFAULT 'pending'::character varying,
    priority character varying(20) DEFAULT 'normal'::character varying,
    assigned_to integer,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.fuel_requests OWNER TO postgres;

--
-- Name: fuel_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.fuel_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.fuel_requests_id_seq OWNER TO postgres;

--
-- Name: fuel_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.fuel_requests_id_seq OWNED BY public.fuel_requests.id;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.orders (
    id integer NOT NULL,
    quotation_id integer,
    customer_id integer,
    order_number character varying(50) NOT NULL,
    fuel_type character varying(50) NOT NULL,
    quantity numeric(15,2) NOT NULL,
    unit character varying(20) NOT NULL,
    unit_price numeric(15,2) NOT NULL,
    total_amount numeric(15,2) NOT NULL,
    tax_amount numeric(15,2) DEFAULT 0,
    grand_total numeric(15,2) NOT NULL,
    delivery_address text,
    delivery_city character varying(100),
    delivery_state character varying(100),
    delivery_country character varying(100),
    delivery_postal_code character varying(50),
    preferred_delivery_date date,
    preferred_delivery_time character varying(50),
    purchase_order_number character varying(100),
    purchase_order_filename character varying(255),
    purchase_order_path character varying(500),
    status character varying(50) DEFAULT 'pending_payment'::character varying,
    payment_status character varying(50) DEFAULT 'pending'::character varying,
    payment_proof_filename character varying(255),
    payment_proof_path character varying(500),
    payment_verified_by integer,
    payment_verified_at timestamp without time zone,
    payment_notes text,
    created_by integer,
    notes text,
    completed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.orders OWNER TO postgres;

--
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.orders_id_seq OWNER TO postgres;

--
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;


--
-- Name: quotations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.quotations (
    id integer NOT NULL,
    fuel_request_id integer,
    customer_id integer,
    quotation_number character varying(50) NOT NULL,
    fuel_type character varying(50) NOT NULL,
    quantity numeric(15,2) NOT NULL,
    unit character varying(20) NOT NULL,
    unit_price numeric(15,2) NOT NULL,
    total_amount numeric(15,2) NOT NULL,
    tax_amount numeric(15,2) DEFAULT 0,
    grand_total numeric(15,2) NOT NULL,
    valid_until date NOT NULL,
    delivery_terms text,
    payment_terms text,
    status character varying(50) DEFAULT 'draft'::character varying,
    sent_date timestamp without time zone,
    accepted_date timestamp without time zone,
    created_by integer,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    tax_rate numeric(5,2) DEFAULT 0.00
);


ALTER TABLE public.quotations OWNER TO postgres;

--
-- Name: quotations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.quotations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.quotations_id_seq OWNER TO postgres;

--
-- Name: quotations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.quotations_id_seq OWNED BY public.quotations.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    email character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    role character varying(50) DEFAULT 'customer'::character varying,
    phone character varying(50),
    is_active boolean DEFAULT true,
    last_login timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: content id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.content ALTER COLUMN id SET DEFAULT nextval('public.content_id_seq'::regclass);


--
-- Name: customers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers ALTER COLUMN id SET DEFAULT nextval('public.customers_id_seq'::regclass);


--
-- Name: fuel_requests id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fuel_requests ALTER COLUMN id SET DEFAULT nextval('public.fuel_requests_id_seq'::regclass);


--
-- Name: orders id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);


--
-- Name: quotations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotations ALTER COLUMN id SET DEFAULT nextval('public.quotations_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_logs (id, user_id, action, entity, entity_id, old_values, new_values, ip_address, user_agent, created_at) FROM stdin;
\.


--
-- Data for Name: content; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.content (id, title, content_type, content, slug, meta_description, status, published_at, published_by, created_by, created_at, updated_at) FROM stdin;
1	Welcome to GlowBulk	announcement	GlowBulk is now live! Our B2B bulk-fuel management platform is ready for you to submit fuel requests, receive quotations, and track your orders.	welcome-to-glowbulk	GlowBulk B2B fuel management platform announcement	published	2026-08-31 10:57:00.313824	1	1	2026-08-31 10:56:37.161289	2026-08-31 10:57:00.313824
2	bulk fuel	fuel_info	glow petroleum provides high quality fuel for.....	bulk-fuel-information	learn about Glow Petroleum's bulkk fuel offeringand how to order	published	\N	\N	1	2026-09-01 09:14:14.725598	2026-09-04 14:33:58.213868
17	fuel information	fuel_info	er6t7vyhbiuj	diesel-pricing-update	dftgyh	published	\N	\N	1	2026-09-07 09:36:03.509257	2026-09-07 09:36:03.509257
\.


--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.customers (id, user_id, company_name, company_registration, billing_address, billing_city, billing_state, billing_country, billing_postal_code, delivery_address, delivery_city, delivery_state, delivery_country, delivery_postal_code, tax_number, industry, contact_person_name, contact_person_email, contact_person_phone, preferred_fuel_types, status, credit_limit, notes, created_at, updated_at) FROM stdin;
1	1	dawn	4965768	a64ertb87	e5utdfu	\N	sfgddfyuli	\N	reyitugpiuh	etrytfuyl	\N	yfkugiuh	\N	\N	0il and gas	uygj	ardgjh@gmail.com	2656780890	{}	pending	\N	\N	2026-08-28 11:14:48.934156	2026-09-01 09:05:15.850303
2	4	dawn	1234	324wetdrytu	Harare	\N	Zimbabwe	\N	123 waterford	bulawayo	\N	Zimbabwe	\N	\N	0il and gas	srtdifyo bjn,	ardgjh@gmail.com	2656780890	{}	pending	0.00	\N	2026-09-01 15:16:51.138926	2026-09-01 15:16:51.138926
3	14	DeanNgwinus	12345	32ewdw	Harare	\N	Zimbabwe	\N	2wedfgbv	Masvingo	\N	Zimbabwe	\N	\N	Mining	Dean Mungwini	wsgh@gmail.com	123456789	{}	pending	0.00	\N	2026-09-02 09:13:49.130465	2026-09-03 11:23:12.347701
4	15	Concilia	6789	5e8r9yogu	Harare	\N	Zimbabwe	\N	Masvingo	Masvingo	\N	Zimbabwe	\N	\N	Transport	Concilia Mungwini	d@gmail.com	0780759231	{}	pending	0.00	\N	2026-09-07 09:07:41.1935	2026-09-07 09:07:41.1935
\.


--
-- Data for Name: fuel_requests; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.fuel_requests (id, customer_id, fuel_type, quantity, unit, delivery_address, delivery_city, delivery_state, delivery_country, delivery_postal_code, preferred_delivery_date, preferred_delivery_time, special_instructions, status, priority, assigned_to, notes, created_at, updated_at) FROM stdin;
1	1	Diesel	5000.00	Liters	456 Industrial Road	Harare	\N	Zimbabwe	\N	2026-09-01	\N	Please deliver to the main gate	quoted	normal	\N	\N	2026-08-28 11:45:22.978739	2026-09-02 13:49:34.13398
3	2	Diesel	500.00	Liters	qEAWFSRTGDF	1QWDASFX	\N	Zimbabwe	\N	2026-09-05	11:00	PLEASE DELIVER ON TIME	accepted	normal	\N	\N	2026-09-02 08:01:24.845931	2026-09-02 13:51:13.190454
2	2	Diesel	27.00	Liters	123 waterford	bulawayo	\N	Zimbabwe	\N	2026-09-14	08:00	qwexrcytuvhj	quoted	normal	\N	\N	2026-09-01 15:18:19.240899	2026-09-02 14:00:13.312132
6	3	Diesel	300.00	Liters	Gweru		\N	Zimbabwe	\N	2026-09-17	00:17	hytefvd	rejected	normal	\N	\N	2026-09-02 09:17:52.657358	2026-09-02 14:15:06.562988
4	3	Diesel	165.00	Liters	Masvingo	Masvingo	\N	Zimbabwe	\N	2026-09-18	11:14	please be on time	accepted	normal	\N	\N	2026-09-02 09:15:07.371468	2026-09-03 16:41:15.710868
5	3	Petrol	200.00	Liters	Masvingo	Masvingo	\N	Zimbabwe	\N	2026-09-11	13:15	be on time	ordered	normal	\N	\N	2026-09-02 09:16:16.660016	2026-09-03 16:44:49.159432
8	4	Diesel	500.00	Liters	Masvingo	Masvingo	\N	Zimbabwe	\N	2026-09-18	13:08	please be on time	quoted	normal	\N	\N	2026-09-07 09:16:31.6793	2026-09-07 09:37:28.295886
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.orders (id, quotation_id, customer_id, order_number, fuel_type, quantity, unit, unit_price, total_amount, tax_amount, grand_total, delivery_address, delivery_city, delivery_state, delivery_country, delivery_postal_code, preferred_delivery_date, preferred_delivery_time, purchase_order_number, purchase_order_filename, purchase_order_path, status, payment_status, payment_proof_filename, payment_proof_path, payment_verified_by, payment_verified_at, payment_notes, created_by, notes, completed_at, created_at, updated_at) FROM stdin;
1	2	1	ORD-20260831-1410	Diesel	5000.00	Liters	1.50	7500.00	1125.00	8625.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	payment_confirmed	confirmed	\N	\N	1	2026-08-31 10:48:14.440251	Payment verified in company bank account - Invoice #INV-001	1	\N	\N	2026-08-31 09:54:50.589579	2026-08-31 10:48:14.440251
2	8	3	ORD-20260903-1454	Petrol	200.00	Liters	1.91	382.00	57.30	439.30	 trhtbj	 44uredfnxcm	tw tfvgsfdjhnm	POWKLA,S.	3455	2026-10-02	17:43	sdtfyhgj	\N	\N	payment_confirmed	confirmed	\N	\N	1	2026-09-03 16:45:27.019075	Payment verified in company bank account	14	dgtfhgjb	\N	2026-09-03 16:44:49.150982	2026-09-03 16:45:27.019075
\.


--
-- Data for Name: quotations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.quotations (id, fuel_request_id, customer_id, quotation_number, fuel_type, quantity, unit, unit_price, total_amount, tax_amount, grand_total, valid_until, delivery_terms, payment_terms, status, sent_date, accepted_date, created_by, notes, created_at, updated_at, tax_rate) FROM stdin;
2	1	1	Q-20260831-0179	Diesel	5000.00	Liters	1.50	7500.00	1125.00	8625.00	2026-09-15	Delivery within 3 business days	Payment within 7 days of invoice	accepted	\N	2026-08-31 08:10:45.924212	1	Special pricing for bulk order	2026-08-31 08:05:24.38537	2026-08-31 08:10:45.924212	0.00
1	1	1	Q-20260828-1442	Diesel	5000.00	Liters	1.50	7500.00	1125.00	8625.00	2026-09-15	Delivery within 3 business days	Payment within 7 days of invoice	expired	\N	\N	1	Special pricing for bulk order	2026-08-28 14:28:05.247795	2026-09-02 12:34:09.346668	0.00
4	1	1	Q-20260902-3985	Diesel	5000.00	Liters	2.00	10000.00	1500.00	11500.00	2026-09-30	xedcfyguhjl	fyguh	sent	\N	\N	1	ex5rc6vtyb	2026-09-02 13:49:25.175395	2026-09-02 13:49:34.132374	0.00
5	3	2	Q-20260902-0609	Diesel	500.00	Liters	2.00	1000.00	150.00	1150.00	2026-09-10	zsxdctyfvgj	7e58f6gy	accepted	\N	2026-09-02 13:51:13.18357	1	ygbnjoipl	2026-09-02 13:50:20.018802	2026-09-02 13:51:13.18357	0.00
6	2	2	Q-20260902-9326	Diesel	27.00	Liters	1.87	50.49	7.57	58.06	2026-10-02	dfgvhbof	 fvghbijn	sent	\N	\N	1	qzxtcy	2026-09-02 14:00:13.304688	2026-09-02 14:00:13.304688	0.00
3	6	3	Q-20260902-2384	Diesel	300.00	Liters	1.50	450.00	67.50	517.50	2026-09-04	dfgvhbof	 fvghbijn	rejected	\N	\N	1	edtfcygjh	2026-09-02 12:35:06.102072	2026-09-02 14:15:06.556241	0.00
8	5	3	Q-20260903-4082	Petrol	200.00	Liters	1.91	382.00	57.30	439.30	2026-09-24	irutcvihyfr	srzdtxfhg	accepted	\N	2026-09-03 16:15:59.058781	1	w45srdyt	2026-09-03 16:15:35.348836	2026-09-03 16:15:59.058781	15.00
7	4	3	Q-20260902-1431	Diesel	165.00	Liters	2.00	330.00	12.41	342.41	2026-09-27	fdcxfg	jhguu	accepted	\N	2026-09-03 16:41:15.705073	1	gvcfdgf	2026-09-02 15:08:44.882853	2026-09-03 16:41:15.705073	3.76
9	8	4	Q-20260907-8252	Diesel	500.00	Liters	1.38	690.00	103.50	793.50	2026-09-17	delivery within 7 days	payment within 1 day	sent	\N	\N	1	f9guhi	2026-09-07 09:37:28.287183	2026-09-07 09:37:28.287183	15.00
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, first_name, last_name, email, password, role, phone, is_active, last_login, created_at, updated_at) FROM stdin;
4	test	user	testuser@example.com	$2b$10$V5G9YTBqAil3.llPZsp30Op7UemhUeaokOUPoUiCIrtjR6Sn0o2eW	customer	\N	t	2026-09-02 15:17:23.139578	2026-09-01 09:42:29.625447	2026-09-01 09:42:29.625447
12	dee	dee	ewretr@gmail.com	$2b$10$U0wCHj1DBlAfa9hi4muC6.N1ky.4rvQavgJQV3W1duF.IrKNVuuv.	customer	\N	t	2026-09-01 11:37:11.303845	2026-09-01 11:37:11.181047	2026-09-01 11:37:11.181047
15	conci	divine	aestdgh@gmail.com	$2b$10$KNhezXtbUJqgreWBJtFNIu1qbtmN01Cjr2bS0V4dtd/ngulw6Epy2	customer	\N	t	2026-09-04 15:58:27.919261	2026-09-04 15:58:27.843448	2026-09-04 15:58:27.843448
1	Admin	Glow	admin@glowpetroleum.com	$2b$10$7AhODbTOdWQpycQmCRc5PeeEwk7t3VzJejEuODuukHONuaCX4jl/m	admin	\N	t	2026-09-07 09:16:56.617267	2026-08-28 09:12:08.167309	2026-08-28 09:12:08.167309
2	Dawn	Mungwini	d.mungwini18@gmail.com	$2b$10$KDJsT34umuiGpNYKw7E/YOyrMbu.S.zbEI0lkmwIBCTJKlq1uQ1o2	customer	\N	t	2026-08-31 15:57:08.404043	2026-08-31 15:56:57.837473	2026-08-31 15:56:57.837473
14	Dean	Mungwini	c3budxn@gmail.com	$2b$10$Q3.J/VeEWTn76SYCDWoumuDmH5pvmDlwoziv1TNq82qKumlEX4gk6	customer	\N	t	2026-09-07 09:38:36.291142	2026-09-02 09:10:19.102559	2026-09-02 09:10:19.102559
3	dawn	dee	dawn@test.com	$2b$10$VHt7Sfv0WilcNLR9o5bPeOY1VsEOQRF6OreUzAiDXs/KV8p0E3yWC	customer	\N	t	2026-09-01 09:20:29.205419	2026-09-01 09:20:01.016948	2026-09-01 09:20:01.016948
13	dawn	e3rqgtsf	ddefwarzsx@gmail.com	$2b$10$ulS.n883sopvWEmLOkjhB.wd4WySK6cwgVTjXI47Myi8yZ8Jh1i1m	customer	\N	t	2026-09-01 15:38:04.12734	2026-09-01 15:38:04.004416	2026-09-01 15:38:04.004416
5	atwesyrdjfchgvj	aesdjf	waesrdyhj@gmail.com	$2b$10$bXmjd0ti.rgkK50ZngbKIO1Lompf/UB/pIz6vaQV4.pjRAoG7ijpm	customer	\N	t	2026-09-01 10:06:27.016097	2026-09-01 10:06:26.887477	2026-09-01 10:06:26.887477
6	vgqcuiawe	v6	c3buDXN@gmail.com	$2b$10$h3IKEZ7W8/ttbYk4J3NroeLInxwbFUwNhIRAQ/P5T82VVR6Pf7wDm	customer	\N	t	2026-09-01 10:35:26.216521	2026-09-01 10:35:26.096537	2026-09-01 10:35:26.096537
7	 5r6	3g7U	test@example.com	$2b$10$L/xGmwkLQckUzp.wp2q7JeWR9q7tLrN2KCg4bjEyKqijR3YqkJBpy	customer	\N	t	2026-09-01 10:36:17.2728	2026-09-01 10:36:17.156187	2026-09-01 10:36:17.156187
8	23	q4r	q45w6f@gmail.com	$2b$10$2Akt5ys3paKjQoDPwRVQ7eDz6aV.9G5eKirs.dUmnCaLWGFAy8rYS	customer	\N	t	2026-09-01 10:42:25.381255	2026-09-01 10:42:25.264941	2026-09-01 10:42:25.264941
9	wert	wesrdf	t@example.com	$2b$10$YLsW.PH3fRUj/YN8hQAq1uWapYzoHhWWlTjfg44vm0jwB87Gcmzl2	customer	\N	t	2026-09-01 11:01:41.854115	2026-09-01 11:01:41.689602	2026-09-01 11:01:41.689602
10	as	dsfg	dr@example.com	$2b$10$49OQIY6RjOMmmEzsx6IXx.20ng2Y2ZtCIul2YkzSechygFkdZACb2	customer	\N	t	2026-09-01 11:03:18.942801	2026-09-01 11:03:18.831024	2026-09-01 11:03:18.831024
11	qwe	aszdfx	asdf@gmail.com	$2b$10$hkwZyF32VZun2BLNoZN0kuCW3tC6legBVEeEWqFrkXAN5FJXEKpti	customer	\N	t	2026-09-01 11:16:28.411139	2026-09-01 11:16:28.289302	2026-09-01 11:16:28.289302
\.


--
-- Name: audit_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.audit_logs_id_seq', 1, false);


--
-- Name: content_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.content_id_seq', 17, true);


--
-- Name: customers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.customers_id_seq', 4, true);


--
-- Name: fuel_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.fuel_requests_id_seq', 8, true);


--
-- Name: orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.orders_id_seq', 2, true);


--
-- Name: quotations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.quotations_id_seq', 9, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 15, true);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: content content_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.content
    ADD CONSTRAINT content_pkey PRIMARY KEY (id);


--
-- Name: content content_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.content
    ADD CONSTRAINT content_slug_key UNIQUE (slug);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: fuel_requests fuel_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fuel_requests
    ADD CONSTRAINT fuel_requests_pkey PRIMARY KEY (id);


--
-- Name: orders orders_order_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_order_number_key UNIQUE (order_number);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: quotations quotations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT quotations_pkey PRIMARY KEY (id);


--
-- Name: quotations quotations_quotation_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT quotations_quotation_number_key UNIQUE (quotation_number);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: content content_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.content
    ADD CONSTRAINT content_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: content content_published_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.content
    ADD CONSTRAINT content_published_by_fkey FOREIGN KEY (published_by) REFERENCES public.users(id);


--
-- Name: customers customers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: fuel_requests fuel_requests_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fuel_requests
    ADD CONSTRAINT fuel_requests_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: fuel_requests fuel_requests_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fuel_requests
    ADD CONSTRAINT fuel_requests_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: orders orders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: orders orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: orders orders_payment_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_payment_verified_by_fkey FOREIGN KEY (payment_verified_by) REFERENCES public.users(id);


--
-- Name: orders orders_quotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES public.quotations(id) ON DELETE CASCADE;


--
-- Name: quotations quotations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT quotations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: quotations quotations_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT quotations_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: quotations quotations_fuel_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT quotations_fuel_request_id_fkey FOREIGN KEY (fuel_request_id) REFERENCES public.fuel_requests(id) ON DELETE CASCADE;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO glowbulk_user;


--
-- Name: TABLE audit_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.audit_logs TO glowbulk_user;


--
-- Name: SEQUENCE audit_logs_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.audit_logs_id_seq TO glowbulk_user;


--
-- Name: TABLE content; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.content TO glowbulk_user;


--
-- Name: SEQUENCE content_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.content_id_seq TO glowbulk_user;


--
-- Name: TABLE customers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.customers TO glowbulk_user;


--
-- Name: SEQUENCE customers_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.customers_id_seq TO glowbulk_user;


--
-- Name: TABLE fuel_requests; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.fuel_requests TO glowbulk_user;


--
-- Name: SEQUENCE fuel_requests_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.fuel_requests_id_seq TO glowbulk_user;


--
-- Name: TABLE orders; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.orders TO glowbulk_user;


--
-- Name: SEQUENCE orders_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.orders_id_seq TO glowbulk_user;


--
-- Name: TABLE quotations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.quotations TO glowbulk_user;


--
-- Name: SEQUENCE quotations_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.quotations_id_seq TO glowbulk_user;


--
-- Name: TABLE users; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.users TO glowbulk_user;


--
-- Name: SEQUENCE users_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.users_id_seq TO glowbulk_user;


--
-- PostgreSQL database dump complete
--

\unrestrict smp5pCe1EpZca50dnCteMnj4FBJnX5QVhFM6utXdAucDZb66FxVdrOhzy1PxnC1

