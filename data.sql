--
-- PostgreSQL database dump
--

\restrict EI6Zs1na4fYYJ9boGIRkuOZwe1G3JRtfFqVyZ4VnwTA5I6zK0fOMAU2wsugXV7c

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

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

--
-- Data for Name: markets; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.markets VALUES ('52af90a8-6444-47de-9bdc-1e5e1e067702', '경부선', 1, '2026-01-05 13:10:39.200675+00');
INSERT INTO public.markets VALUES ('480e88b0-954e-4083-8081-caf4f46d811d', '양재', 2, '2026-01-03 13:59:22.848029+00');
INSERT INTO public.markets VALUES ('d6bafacc-2b4b-4e81-a615-db6732fe099a', '호남선', 3, '2026-01-05 13:10:39.200675+00');


--
-- Data for Name: vendors; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.vendors VALUES ('7a9820c6-b886-467c-b3d4-70d00fad4c48', '중앙화훼유통', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, NULL);
INSERT INTO public.vendors VALUES ('b657df6e-ece1-4e8c-85a2-353be1c2a413', '초전상사', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '99');
INSERT INTO public.vendors VALUES ('4c947824-6d02-4b18-9acd-bbe9befa636d', '그린원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '98-1');
INSERT INTO public.vendors VALUES ('77a20ec5-635e-4679-b5e7-a1ebf2109722', '프쉬케', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '97');
INSERT INTO public.vendors VALUES ('abdd6cac-6d79-46a7-b117-c1809bb4a8c5', '금회원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '96');
INSERT INTO public.vendors VALUES ('71d604ae-7b38-4cfa-ac8c-52ddb55f7e77', '용호원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '95');
INSERT INTO public.vendors VALUES ('63ffe96c-259c-4490-ab91-8b049da4c411', '우정원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '94');
INSERT INTO public.vendors VALUES ('5b1b93fd-74fe-4087-b289-c18a8dbad135', '봉천원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '93');
INSERT INTO public.vendors VALUES ('65bb6d80-63c8-4663-a67b-4396c54d7573', '모나리자', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '92');
INSERT INTO public.vendors VALUES ('e8f62651-de09-4ad7-b45b-91a438e25c3b', '수아레', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '90-1');
INSERT INTO public.vendors VALUES ('af2a2fd5-6070-4dca-b9d5-ef83f68a5ea0', '제일리본', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '9');
INSERT INTO public.vendors VALUES ('64770b6a-35f7-4017-a369-6ea451870822', '다원플라워', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '89');
INSERT INTO public.vendors VALUES ('e682df4b-61e5-45d0-948d-ce746dc0fb66', '청운원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '87');
INSERT INTO public.vendors VALUES ('8ccabbf3-fe47-4dbb-b855-2dda7e8ec9e5', '유진원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '86');
INSERT INTO public.vendors VALUES ('d66eb08e-4074-4cbb-976f-163dadeb4cec', '일광원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '85');
INSERT INTO public.vendors VALUES ('e3c9032b-51ff-4c70-bde6-356f659adb81', '동호원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '84');
INSERT INTO public.vendors VALUES ('ceedc657-db03-41d8-ab40-b6eb7fbee2de', '이화농상', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '83');
INSERT INTO public.vendors VALUES ('cc1c2696-62de-47b6-8b42-5ea1cc4c28a4', '조흥농원', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '82');
INSERT INTO public.vendors VALUES ('5bf427ac-0282-49ee-bd24-9400edefa9d6', '카네이션전문', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '81');
INSERT INTO public.vendors VALUES ('a6f78653-c123-4410-b101-e128f1356ee3', '올리브장미', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '80');
INSERT INTO public.vendors VALUES ('8115e814-8906-4fc7-8abc-f600651f9bfd', '예향플라워', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '8');
INSERT INTO public.vendors VALUES ('4dbb3398-d10a-415a-bfe6-9dcbf848cae9', '서울장미', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '79');
INSERT INTO public.vendors VALUES ('8641d1ed-de12-4e16-9c0a-83c75a6ee8e9', '강남원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '78');
INSERT INTO public.vendors VALUES ('37ecc9cf-7efb-4f39-929f-f51203ff10f6', '영월원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '77');
INSERT INTO public.vendors VALUES ('7a3961f8-a803-4ae8-bea4-96767dfdb298', '백제원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '76');
INSERT INTO public.vendors VALUES ('f5b4418f-6acf-4f45-8cfb-25b7b7eb4c7c', '아리랑농원', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '75');
INSERT INTO public.vendors VALUES ('9326d852-4ca9-4c46-a81b-cd695700eb4a', '수영원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '74-2');
INSERT INTO public.vendors VALUES ('06ea9591-218f-4e4f-b2ea-88da961674c3', '양지원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '74-1');
INSERT INTO public.vendors VALUES ('311ba5b1-9465-4fe5-ad9a-19c5281737ca', '애라장미', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '72-2');
INSERT INTO public.vendors VALUES ('dc920d4b-c160-476f-8322-87ce3bfae106', '싱싱원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '73');
INSERT INTO public.vendors VALUES ('b74c98dc-f902-4e21-b560-08d08030c6b5', '신안원예 (수입)', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '71');
INSERT INTO public.vendors VALUES ('86c654ce-c9b8-4a28-9619-4a955168c9aa', 'OB원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '70');
INSERT INTO public.vendors VALUES ('3d3290bc-f73f-47b8-a1f7-b32a553a2839', '윤희원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '7-1');
INSERT INTO public.vendors VALUES ('1fd73368-7974-4a53-bfab-9e65b361a527', '민영상사', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '69');
INSERT INTO public.vendors VALUES ('4b3d11fe-c3f4-40aa-8b1e-ca015b510512', '시대원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '68-2');
INSERT INTO public.vendors VALUES ('9b3dbe80-9197-47cd-9e3c-9453bcebadc1', '청풍원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '68-1');
INSERT INTO public.vendors VALUES ('9b70d76d-9613-4c11-868f-6200becc0813', '성수원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '67');
INSERT INTO public.vendors VALUES ('db209f17-aca6-4a0c-ac7f-2f77a7fd9f65', '조은원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '66');
INSERT INTO public.vendors VALUES ('b31f7233-80eb-4e47-8753-2bb33f601018', '다남원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '65-2');
INSERT INTO public.vendors VALUES ('fa81b626-d8fc-4660-be1d-92ea94681f8b', '스마트생화', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '65-1');
INSERT INTO public.vendors VALUES ('309c601e-3953-4d65-bd03-4db77ba0fac8', '금호원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '64-1');
INSERT INTO public.vendors VALUES ('ffc706ac-d050-4e37-a5ad-7987f502e290', '파랑새', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '63');
INSERT INTO public.vendors VALUES ('733e26e1-a4e0-48f4-a102-ee11f4251035', '삼화원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '62');
INSERT INTO public.vendors VALUES ('77a784b6-4f83-49a4-b1e3-e69cd9d9ab05', '이룸플라워', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '61');
INSERT INTO public.vendors VALUES ('8e40bda5-8290-405d-814e-01aa4192027b', '동일원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '60');
INSERT INTO public.vendors VALUES ('b2a89ab9-a261-45ad-9284-12a6491c426e', '정우원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '6-2');
INSERT INTO public.vendors VALUES ('8616bc98-b679-464f-abff-b2e07835e409', '향기원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '6-1');
INSERT INTO public.vendors VALUES ('7b052c53-953a-4e8d-81d3-5409c229e048', '아름', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '59');
INSERT INTO public.vendors VALUES ('fec99ea6-c9d9-4596-a54b-ad8f0bc8136e', '대성원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '58');
INSERT INTO public.vendors VALUES ('1ad9fa03-0427-4649-95bc-d8b3d34138ab', '대지원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '57');
INSERT INTO public.vendors VALUES ('4ba275e9-c4e6-4422-b872-06af5dc2a773', '동화림원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '56');
INSERT INTO public.vendors VALUES ('9e3b5fce-f177-4b17-8880-d4829f0ddb17', '신장원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '55');
INSERT INTO public.vendors VALUES ('a623d346-15ce-4270-81fa-4559f279bf1c', '낙동원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '54');
INSERT INTO public.vendors VALUES ('fe434d22-19fb-4ca8-94aa-efd7d6b9a2d1', '청화원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '53');
INSERT INTO public.vendors VALUES ('4913b24c-12ec-40cf-9096-b79cf3849a70', '우주원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '52');
INSERT INTO public.vendors VALUES ('9d30b120-b506-4f42-933c-922b327327dd', '제일도기', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '51');
INSERT INTO public.vendors VALUES ('e3d8bdb8-4186-406b-b7a8-77d3a86646f5', '진수원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '50');
INSERT INTO public.vendors VALUES ('032535dc-ea2a-4bc4-b849-3d175d02277c', '창원원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '5');
INSERT INTO public.vendors VALUES ('272f1428-1418-4aa9-a69c-edcbe84bbdd1', '달성플라워', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '49-2');
INSERT INTO public.vendors VALUES ('ffe3e6d3-ad07-4815-81fe-519d1394b4a9', '칼라꽃집', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '49-1');
INSERT INTO public.vendors VALUES ('79b80a82-aa50-4d7c-ab74-2763613021e1', '장안원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '48');
INSERT INTO public.vendors VALUES ('2615ff02-6df0-41fd-a7e5-05b1d1e207c5', '영림원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '47');
INSERT INTO public.vendors VALUES ('2891764d-d8f2-47b5-953b-b5cdbf1d4587', '송림원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '46-2');
INSERT INTO public.vendors VALUES ('8d23723d-943e-433a-9f63-d890c7625063', '삼육원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '46-1');
INSERT INTO public.vendors VALUES ('0b27ccd0-0432-4f0b-abd1-a5806f0c2b80', '맥스아디엘', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '45');
INSERT INTO public.vendors VALUES ('abb1ca62-4d2a-4f4c-b21c-5bfa5f6cf5bb', '새누리원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '44');
INSERT INTO public.vendors VALUES ('1c9096a3-6dc1-4254-8e7b-c2142ee785c3', '유리원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '43');
INSERT INTO public.vendors VALUES ('ff10b641-8f6a-4d9f-8fd5-6b59f10a0eb0', '태양원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '42');
INSERT INTO public.vendors VALUES ('0fe39c3a-88c5-42f6-8a5a-32cea2a30369', '경태원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '41');
INSERT INTO public.vendors VALUES ('d80caa90-e0a4-443a-af44-5c86d0a045f3', '김바우원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '40');
INSERT INTO public.vendors VALUES ('ecf229f4-6fab-49f6-99ca-0628fabded91', '연암원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '4');
INSERT INTO public.vendors VALUES ('c8178831-89ef-4b97-a47f-7148675cecf5', '인천원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '39');
INSERT INTO public.vendors VALUES ('132c9c68-249d-4861-b063-5362f011d41e', '이호원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '37');
INSERT INTO public.vendors VALUES ('c30ef8b6-2a11-4141-b1ba-fc2c7c584d18', '김포원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '36');
INSERT INTO public.vendors VALUES ('2da9e563-aafb-4fb3-826b-99bf5818928a', '형제원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '35-2');
INSERT INTO public.vendors VALUES ('d2aadd16-944c-4928-94b1-9aef8ff69aed', '블루밍', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '34');
INSERT INTO public.vendors VALUES ('08ad0e05-b400-4597-aa26-22eb1059cedb', '아디엘꽃방', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '33');
INSERT INTO public.vendors VALUES ('b6c96e73-84f9-464a-8f39-b535b5695456', '상현원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '32');
INSERT INTO public.vendors VALUES ('27f7e5a2-1ede-4db0-a80d-9e92df060ed4', '도영원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '31-2');
INSERT INTO public.vendors VALUES ('903049c4-e00e-4767-8077-c849e83edf14', '보람꽃방', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '30-1');
INSERT INTO public.vendors VALUES ('0e2b5e0c-cbca-4769-8180-82b63d18076c', '정아원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '3');
INSERT INTO public.vendors VALUES ('80905a52-c795-445d-91b8-25f083fcf692', '축복원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '29');
INSERT INTO public.vendors VALUES ('21a597b6-ad43-49d4-b4f7-9314d65431f5', '늘호황원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '28');
INSERT INTO public.vendors VALUES ('e79a9f0b-29e8-4948-bd48-e068decb78dd', '(동)안성원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '27');
INSERT INTO public.vendors VALUES ('fc0da2ff-6438-4943-a7e5-0d693e54583f', '미경상사', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '26');
INSERT INTO public.vendors VALUES ('53fa507a-7b3d-4740-bf0b-34878f6d8cb0', '주광농원', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '25');
INSERT INTO public.vendors VALUES ('fd747dae-cced-47a3-9fc2-0a5fa1022d4f', '수석원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '24');
INSERT INTO public.vendors VALUES ('aaa5263f-758b-4e50-83f2-ee3ce56e03b8', '햇살농원', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '23');
INSERT INTO public.vendors VALUES ('f0985f98-8adf-4887-bf7e-15de74409280', '화정원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '22');
INSERT INTO public.vendors VALUES ('6e1d01f3-1da0-4a36-883a-9e2757cd54e0', '영남원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '21');
INSERT INTO public.vendors VALUES ('432bf507-dcf7-4810-8c2f-d25a117f1dc8', '목동원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '20-2');
INSERT INTO public.vendors VALUES ('bd42fea6-d746-4a79-8e28-f0d1049ce9bb', '중앙소재', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '2');
INSERT INTO public.vendors VALUES ('546f85ec-2302-4ad4-a4fd-992a1de610d7', '현대리본', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '180');
INSERT INTO public.vendors VALUES ('a533f922-2d2d-4fa0-84a6-ed072c775ee6', '신신도기', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '18');
INSERT INTO public.vendors VALUES ('1dc35069-0f54-456d-97dd-7533814745af', '소재2호', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '17');
INSERT INTO public.vendors VALUES ('7d857db7-34fd-4961-837f-46dfa685e6d6', '선그로원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '161');
INSERT INTO public.vendors VALUES ('9b2a7d82-ae41-49e5-9297-b5c24355d8c7', '정민원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '160');
INSERT INTO public.vendors VALUES ('6a37f167-141b-40e8-8eba-2025d1e75d4b', '화사랑', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '159');
INSERT INTO public.vendors VALUES ('ae244959-83d6-4280-9dc7-ff0dc3df704c', '원당원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '158');
INSERT INTO public.vendors VALUES ('664cc99d-4443-406a-b499-0ba86aa08db8', '화지몽', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '156');
INSERT INTO public.vendors VALUES ('a72a562f-4591-4308-99bb-e53c5534dd93', '로즈앤1', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '155');
INSERT INTO public.vendors VALUES ('1dae54ce-9726-440f-ae81-20132ebe6132', '세유상사(로즈앤1)', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '154');
INSERT INTO public.vendors VALUES ('27317df3-9cd2-440c-a2bf-e3cf4106089f', '햇빛나라', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '153');
INSERT INTO public.vendors VALUES ('8b811e6e-a3bb-47ed-8ee6-aac00a6d4d73', '남촌원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '152');
INSERT INTO public.vendors VALUES ('4bd2b70e-0b85-4ae2-8eec-34907c3dbaa9', '생초상사', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '151');
INSERT INTO public.vendors VALUES ('bc4568e3-54dd-4b5a-82ec-7471768cbd54', '백합원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '150-2');
INSERT INTO public.vendors VALUES ('4b688b32-da13-44e4-b4ec-4a436eda5cea', '꽃나라원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '150-1');
INSERT INTO public.vendors VALUES ('85754733-8ab9-4e2b-8ee7-027d830adafb', '한희꽃상사', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '15');
INSERT INTO public.vendors VALUES ('b10e5e86-f6a6-43f5-a08d-a5d85b063f40', '강산원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '147');
INSERT INTO public.vendors VALUES ('f693fd08-b90f-40b5-b1c2-160942655d25', '마르시아', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '144');
INSERT INTO public.vendors VALUES ('e3084834-85d3-4ea6-919d-c8e2b0870201', '신라원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '143');
INSERT INTO public.vendors VALUES ('77543112-4854-4e2e-afd5-a2ad46eb4917', '덕산원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '142');
INSERT INTO public.vendors VALUES ('f1dc4713-60dd-4e9c-9e67-2f871867ec32', '월드유통', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '141');
INSERT INTO public.vendors VALUES ('932d5b15-8ca9-49fd-a898-a1bc81d9a5b2', '신라상사', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '139');
INSERT INTO public.vendors VALUES ('04aca436-fec2-4d13-bc94-855c025a681c', '한라원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '138');
INSERT INTO public.vendors VALUES ('90c114e6-95b0-4b5f-be6c-cf4b6d92e815', '화란방/다래원', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '136');
INSERT INTO public.vendors VALUES ('1491490f-f482-426f-a4c8-53493d530e84', '한가람원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '134');
INSERT INTO public.vendors VALUES ('5cdd5fe1-e2ee-4c18-83a4-2d55e46d9de0', '불이농장', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '132');
INSERT INTO public.vendors VALUES ('5bba460a-0dda-41f8-8ba4-7588b3b7b362', '일신원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '131');
INSERT INTO public.vendors VALUES ('080d6724-3f88-4c09-bd10-a596b5c81c99', '화신원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '130');
INSERT INTO public.vendors VALUES ('097f6244-7214-4e63-a9a1-4524c611d076', '강릉원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '13');
INSERT INTO public.vendors VALUES ('64716122-82de-4fd9-878f-dade4f50a47c', '유성원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '129');
INSERT INTO public.vendors VALUES ('95b4306f-67da-45a3-99f1-18c8294f6e87', '신흥원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '128');
INSERT INTO public.vendors VALUES ('83d0cbfe-80ec-47d6-a7cf-b723842fc956', '기억꽃집', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '127');
INSERT INTO public.vendors VALUES ('3cd6f0e0-b7e5-43b8-8c1a-b0eacfcaeb33', '대한원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '124');
INSERT INTO public.vendors VALUES ('ed863c0e-c273-48c8-bb0f-94efd6288e16', '원정원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '123');
INSERT INTO public.vendors VALUES ('15ff67d3-b46f-417a-b013-4dd4d8de8ea6', '억불원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '122');
INSERT INTO public.vendors VALUES ('70c25411-45ee-49c6-a6aa-e090f69d656f', '빅토리아', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '121');
INSERT INTO public.vendors VALUES ('5dd08a80-3956-402a-9ed0-83cae079143a', '대동원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '120');
INSERT INTO public.vendors VALUES ('40892188-ec32-4ca6-9b92-597ca68385f3', '신화장미', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '12');
INSERT INTO public.vendors VALUES ('c9c65fc8-cdbd-4eb3-a454-1a34ff71c66d', '고은원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '119');
INSERT INTO public.vendors VALUES ('24969dea-3f3f-4abe-acac-b8ca95514522', '희망원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '118');
INSERT INTO public.vendors VALUES ('d777a098-1467-42bd-aa38-7736287fa0ab', '안성원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '117');
INSERT INTO public.vendors VALUES ('73666728-2918-4fdf-9632-643366b964c1', '상희꽃상사', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '116');
INSERT INTO public.vendors VALUES ('bc25adc5-dca1-4651-b297-0f11c6b7ffa1', '푸른초장', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '115');
INSERT INTO public.vendors VALUES ('5294ee59-927a-4d4b-a055-feda1a1f8040', '신성원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '114-2');
INSERT INTO public.vendors VALUES ('e877701c-50e4-4a8d-9290-3de17702f555', '달물리꽃', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '114-1');
INSERT INTO public.vendors VALUES ('2dffc981-3b8a-441d-89d6-398f909b4328', '동진원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '113-2');
INSERT INTO public.vendors VALUES ('55aee7f5-b5fb-44fd-82ec-d323c758a480', '꽃샘원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '113-1');
INSERT INTO public.vendors VALUES ('743a71c0-2167-43d8-946d-fb8249ee87ab', '대풍원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '112-2');
INSERT INTO public.vendors VALUES ('469ad768-ba3f-4787-9a57-5c691e880690', '태평원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '112-1');
INSERT INTO public.vendors VALUES ('a39c4053-a0be-4f09-8e02-8657c355e4df', '크로바원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '111-2');
INSERT INTO public.vendors VALUES ('5b5cfb26-6dc7-463c-b2d7-ee4da4b85626', '화동원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '111-1');
INSERT INTO public.vendors VALUES ('c0296299-4866-418f-9314-7a9c044ee82f', '부산장미', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '110');
INSERT INTO public.vendors VALUES ('852ddddf-3a6d-4b02-9d34-21c251c0837a', '호정원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '109-2');
INSERT INTO public.vendors VALUES ('20cc5b80-8321-4c71-8f73-f05e20b58ebe', '샤론원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '109-1');
INSERT INTO public.vendors VALUES ('86641917-a994-4722-bbff-8ea7ad60fc34', '털보꽃집', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '108-2');
INSERT INTO public.vendors VALUES ('cb6d5a01-2d7b-4ffc-8b2b-ff6e413d485e', '로얄원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '107');
INSERT INTO public.vendors VALUES ('04c237a4-7190-47ae-88b1-dafa180f1fc1', '미라꽃상사', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '106');
INSERT INTO public.vendors VALUES ('fed4e562-6938-4975-a2cd-6075aac3aa3f', '코코', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '105');
INSERT INTO public.vendors VALUES ('d78ae0ff-5b31-4f5b-912e-3c9d783811f2', '안씨원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '104');
INSERT INTO public.vendors VALUES ('87c30a4b-140e-421d-a5b6-74c59b14a790', '목화원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '103-2');
INSERT INTO public.vendors VALUES ('419106e2-de69-4cb0-ba2e-221fda666ed9', '영주꽃집', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '103-1');
INSERT INTO public.vendors VALUES ('e5a030de-76b6-46d9-a277-5e67290bb9d1', '로즈앤2', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '102-2');
INSERT INTO public.vendors VALUES ('e0f36afc-3cfc-41d4-b517-b7976065bdab', '성창원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '102-1');
INSERT INTO public.vendors VALUES ('ae40c928-e42f-4cd5-893f-5b699cb941c1', '새송림원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '101-2');
INSERT INTO public.vendors VALUES ('e1b9f484-5692-423c-b5b6-bc74e90f2377', '호남소재', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '10');
INSERT INTO public.vendors VALUES ('58ef11d1-c4ae-49b9-92c0-c03de4c569c4', '빌리프', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '256');
INSERT INTO public.vendors VALUES ('22eaa90a-39d8-4854-8b4c-94f24abc575f', '동림플레르', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '259');
INSERT INTO public.vendors VALUES ('7dd73db2-54cd-453f-9fb0-6c342d14338c', '우정', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '248');
INSERT INTO public.vendors VALUES ('53e2efff-cba7-41ec-ae97-1c96c3a029dd', '미우', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '247');
INSERT INTO public.vendors VALUES ('471ff6e4-986c-423f-bc66-b3c821607a81', '신세기원예', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '244');
INSERT INTO public.vendors VALUES ('0ff5a671-40e9-46ee-bea7-0dd3bc04b517', '꽃돌이플라워', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '243');
INSERT INTO public.vendors VALUES ('8e7578fe-56d2-4da0-ac85-524db4e731af', '에덴화원', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '236');
INSERT INTO public.vendors VALUES ('b27c4f7c-886b-447a-8c7d-6a22a8a1a388', '호연꽃자재', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '216');
INSERT INTO public.vendors VALUES ('9ff1775f-e089-47eb-b278-856ad3f41b94', '신신도자기', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '215');
INSERT INTO public.vendors VALUES ('b48188d4-bc82-4ced-987d-642223efa526', '다래소재', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '213');
INSERT INTO public.vendors VALUES ('908a83fc-16dd-47fb-ab5d-b1fa4c8c1442', '대명소재', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '212');
INSERT INTO public.vendors VALUES ('48cfe4bb-04d4-42a1-9590-368d549efe66', '유정꽃바구니', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '211');
INSERT INTO public.vendors VALUES ('49df78a0-9e46-4f99-ba72-7ee3af6d19d6', '꽃피는정원', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '210');
INSERT INTO public.vendors VALUES ('2c3905ca-1ec0-4753-95c1-093091ed1ba7', '나비마을', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '206');
INSERT INTO public.vendors VALUES ('5bfbf77d-4f00-4f57-abfc-5230506023c8', '청산화훼', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '205');
INSERT INTO public.vendors VALUES ('941a0654-cf97-4378-9f5e-a7df6c3df026', '청목소재', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '204');
INSERT INTO public.vendors VALUES ('3221426f-7661-4201-8fff-622848c77ad7', '세방플로라', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '202');
INSERT INTO public.vendors VALUES ('4f60b7e3-b73f-41b5-ab46-6480d31058fd', '오리엔탈무역', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '201');
INSERT INTO public.vendors VALUES ('bd299267-87a5-43c3-80bd-eb97c0b1a2ab', '강남원예', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '196');
INSERT INTO public.vendors VALUES ('f930e7e6-c64c-4425-aca3-67258650006c', '일산플라워', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '195');
INSERT INTO public.vendors VALUES ('32105c31-8fd7-4c4f-a04e-a563a3cd63a0', '달성화원', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '194');
INSERT INTO public.vendors VALUES ('56074fb3-e251-4349-ac0d-893a89290d8a', '플라워녹색공간', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '193');
INSERT INTO public.vendors VALUES ('3bb755e0-14cd-4239-9497-96e12da84757', '윤농원', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '192');
INSERT INTO public.vendors VALUES ('b8f93a53-ee8f-479a-8725-73933b7310d9', '참사랑플라워', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '191');
INSERT INTO public.vendors VALUES ('2b0c2e20-cafb-40fc-98f6-ace67e323502', '강남', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '190');
INSERT INTO public.vendors VALUES ('67e488e9-ffa1-463e-8215-dbe4dfee84f6', '송우플라워시스템', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '188');
INSERT INTO public.vendors VALUES ('3e3b567a-b68f-4f87-9f55-b3fb6a43e666', '루시플라워', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '187');
INSERT INTO public.vendors VALUES ('aed136ec-357b-4dbe-9735-0c254c062870', '명선꽃집', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '186');
INSERT INTO public.vendors VALUES ('4ccce6c8-55d3-4c3b-912d-4776dc212809', '아세아식물원', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '185');
INSERT INTO public.vendors VALUES ('27f2462a-b26d-4fd0-b3ff-3dc0741cd534', '란이네', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '184');
INSERT INTO public.vendors VALUES ('dd8de3cd-db38-44c5-a2ad-0d19bfea2d11', '로얄꽃집', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '183');
INSERT INTO public.vendors VALUES ('b040398b-63dc-490a-b266-2c35514774ee', '꽃과향기', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '182');
INSERT INTO public.vendors VALUES ('0ab5bb22-92ad-4884-9f01-09de9032c407', '밝은꿈', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '181');
INSERT INTO public.vendors VALUES ('c95aa0df-3a08-464c-829f-42effcb3135f', 'I love you', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '179');
INSERT INTO public.vendors VALUES ('7c465bf1-75ee-42fd-97e7-5310311c8aab', '차밍플라워', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '178');
INSERT INTO public.vendors VALUES ('66808383-e6b6-4e45-9ab4-9538188d6f6c', '성남원예', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '177');
INSERT INTO public.vendors VALUES ('a49052f0-fc47-4731-889e-14387626552e', '꽃나라', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '176');
INSERT INTO public.vendors VALUES ('c5db2ee8-3bf1-40e0-8ff5-f69b4ebb03e4', '희플라워', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '175');
INSERT INTO public.vendors VALUES ('3618aad5-8c45-443f-b5e9-0acad398cbdf', '장미원예', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '174');
INSERT INTO public.vendors VALUES ('bb7cd0c4-f5a8-4737-9279-2b6c09a86a69', '연화원', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '173');
INSERT INTO public.vendors VALUES ('0115f15d-c1bd-4851-a179-663d60a5f381', '연플라워', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '172');
INSERT INTO public.vendors VALUES ('c16693c6-57a9-4656-8fc6-863d16aa4435', '플로랑스', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '171');
INSERT INTO public.vendors VALUES ('00cd5000-0a56-409b-ae35-ce6b5486d96c', '수연원예', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '170');
INSERT INTO public.vendors VALUES ('8d04ccc2-3ff6-45d4-8548-c68462591b4a', '또또원예', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '169');
INSERT INTO public.vendors VALUES ('aef54f45-a7b5-4ff6-bf69-406edc71fad9', '구백의천사', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '168');
INSERT INTO public.vendors VALUES ('07ea66f2-dec2-4332-982b-5bf1b7afb0ec', '자연플라워', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '167');
INSERT INTO public.vendors VALUES ('49b72e7e-5c92-445d-9a88-531618d8fa31', '그라시아', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '166');
INSERT INTO public.vendors VALUES ('1933f5bc-17a1-4fa1-94bd-c4835a92cd9c', '타우블', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '165');
INSERT INTO public.vendors VALUES ('7f96ac61-d05e-4558-9473-cffc5ace5854', '남촌원예', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '164');
INSERT INTO public.vendors VALUES ('5f40eb36-6f5f-46ca-a878-7e75749e04c8', '공주플라워', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '162');
INSERT INTO public.vendors VALUES ('4724a7db-cac1-4caa-a531-7a5e593666ba', '블루밍 부케', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '161');
INSERT INTO public.vendors VALUES ('40cb52cc-6f30-4ba2-83fe-36f240b9d9f2', '다원화원', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '160');
INSERT INTO public.vendors VALUES ('6ec7efc5-90e8-4084-9155-f7ff4fe7ac3a', '이레플라워', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '159');
INSERT INTO public.vendors VALUES ('e2912dde-caab-454f-8359-c4a0c6a5aa69', '정은원예', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '157');
INSERT INTO public.vendors VALUES ('7bf87189-3d7c-483a-8c7b-b813b2848fa6', '코벤트원예', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '156');
INSERT INTO public.vendors VALUES ('126c4cbd-5799-4842-ab7f-4f580336175d', '더썬플라워', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '155');
INSERT INTO public.vendors VALUES ('24293e19-c81c-47a6-be31-d2e16307c53b', '피오니', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '154');
INSERT INTO public.vendors VALUES ('6878707b-8c4d-4ea0-a03d-fd2fd067f3b9', '충남난원', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '153');
INSERT INTO public.vendors VALUES ('b732d552-acbd-4bc0-96fe-85bd2a3d848c', '지수원예', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '152');
INSERT INTO public.vendors VALUES ('d92e2f4d-12c1-4536-81f8-f37a49b0866f', '플로라', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '203');
INSERT INTO public.vendors VALUES ('1772d731-337e-4881-a218-742e709e8d43', '미카엘플라워', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '158');
INSERT INTO public.vendors VALUES ('11ac1813-a7bd-4159-8bcd-3ef3158e09b4', '청지화원', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '151');
INSERT INTO public.vendors VALUES ('7264b65d-8ac9-4e00-b55b-33b2d572c370', '조이플라워', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '150');
INSERT INTO public.vendors VALUES ('3650cf4f-7c20-4507-b288-63e01fb1ee51', '서초플라워', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '149');
INSERT INTO public.vendors VALUES ('9d9b74e1-4fe7-4fa9-be08-3ff71b1dc071', '그린화원', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '148');
INSERT INTO public.vendors VALUES ('22c3b781-2749-4844-a622-ffd989ad7084', '초원원예', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '147');
INSERT INTO public.vendors VALUES ('2345dc35-c59b-4190-8552-778aae5f8d16', '꿀벌원예', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '146');
INSERT INTO public.vendors VALUES ('0483d8cd-7c3f-46ef-9342-7d20ac3676be', '복전화원', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '145');
INSERT INTO public.vendors VALUES ('8b973198-46b3-4f78-bf75-3c421156b892', '경향', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '144');
INSERT INTO public.vendors VALUES ('1ac8165d-afc4-4594-9b8b-93bf8598baf6', '대한꽃집', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '143');
INSERT INTO public.vendors VALUES ('4e90bb03-34b7-4e4d-a45b-be1376311b33', '시흥장미', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '142');
INSERT INTO public.vendors VALUES ('532fa6c2-2722-479f-a495-3ce3ae4b3749', '진화원', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '141');
INSERT INTO public.vendors VALUES ('ac1eca01-5479-4546-8cba-a373d920861d', '세림원예', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '140');
INSERT INTO public.vendors VALUES ('3dffc344-7a67-4465-a078-4b21e9bad48f', '매일농원', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '139');
INSERT INTO public.vendors VALUES ('77f94017-858f-4841-a133-cd32e64980c5', '늘봄원예', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '138');
INSERT INTO public.vendors VALUES ('5fdd9d39-1446-40c4-b524-3bf015ed1d4b', '파란마을', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '137');
INSERT INTO public.vendors VALUES ('87aeff1e-77e2-42e0-ab01-17902dfac69d', '미소', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '136');
INSERT INTO public.vendors VALUES ('ee1d71d0-8a52-4e02-a17a-cf45cef1d3da', '호수원예', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '135');
INSERT INTO public.vendors VALUES ('32c3a6b6-e192-4f28-9701-c86d20217931', '빛고을화원', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '134');
INSERT INTO public.vendors VALUES ('b17ae2f8-a6fd-4574-976a-a1a0ffccee50', '플라워#', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '133');
INSERT INTO public.vendors VALUES ('946f9de2-1e78-4495-ad30-50583a675d53', '지희원예', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '130');
INSERT INTO public.vendors VALUES ('cccfb52d-fbb1-4dc5-a259-ccff7f7724ff', '화신원예', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '129');
INSERT INTO public.vendors VALUES ('468a6042-383b-45f1-8f3f-44ab6ec4cabc', '영화원', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '128');
INSERT INTO public.vendors VALUES ('d45ea697-7f04-47a9-bf49-781a682e0204', '경원꽃집', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '127');
INSERT INTO public.vendors VALUES ('2487e27e-da7e-4a0c-8b79-80843edbdb40', '꽃동산', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '126');
INSERT INTO public.vendors VALUES ('f488a895-427b-4022-9e21-72d5d524b8fb', '아이엠', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '125');
INSERT INTO public.vendors VALUES ('88f52d01-b9b7-4b89-a160-9ec4bf49ac3e', 'J.S플라워', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '124');
INSERT INTO public.vendors VALUES ('00587463-83a7-4fe0-8cad-6fbe6f2d8fa7', '진주화원', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '123');
INSERT INTO public.vendors VALUES ('5ed839ee-44a6-40c2-ab6b-a61020c81fd3', '샬롬원예', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '120');
INSERT INTO public.vendors VALUES ('03c7bfd1-d842-4e51-9559-0ca8eb3ca7ac', '모노디노', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '119');
INSERT INTO public.vendors VALUES ('22d55815-3c77-4e6d-96bc-03530668ee62', '알파플라워', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '118');
INSERT INTO public.vendors VALUES ('50860fab-6e73-45ec-a3a0-c1286a40fa2b', '대상화훼', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '117');
INSERT INTO public.vendors VALUES ('85119ca9-98b5-411c-9ec5-5c1b9c427ce6', '흥나미', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '116');
INSERT INTO public.vendors VALUES ('e8427ddd-48d8-4926-b1aa-80dcef89abf5', '위클리', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '115');
INSERT INTO public.vendors VALUES ('067bb249-9acb-44af-9690-65ed75e0491b', '굿모닝플라워', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '114');
INSERT INTO public.vendors VALUES ('46d45233-112d-47c7-9494-2e845a4f15ca', '플라워뱅크', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '113');
INSERT INTO public.vendors VALUES ('7300caeb-aa83-4d90-a240-2371bf1569ad', '우암화원', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '112');
INSERT INTO public.vendors VALUES ('c6ee7b21-b5d6-4973-b1dd-14080951a7cb', '한아름꽃방', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '111');
INSERT INTO public.vendors VALUES ('7fc728f0-ea96-4d93-a6f1-92eb7a385ac0', '유니온', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '110');
INSERT INTO public.vendors VALUES ('662c2584-e6c5-48a9-b4b9-df88cccd9375', '스타일', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '109');
INSERT INTO public.vendors VALUES ('c0096bb5-4989-4dac-a540-0cd3a4e4d61d', '티엔시플라워', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '108');
INSERT INTO public.vendors VALUES ('283d741d-6548-4bce-8be3-bd0290624437', '청플라워', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '107');
INSERT INTO public.vendors VALUES ('ebd568eb-8b38-477f-b1d1-2ecec28ff442', '플라워in', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '105');
INSERT INTO public.vendors VALUES ('ba436ad9-969c-4be5-9e8d-f412772da2c7', '효선원', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '104');
INSERT INTO public.vendors VALUES ('231bc4d2-8fd2-4c58-ab8c-2a18a4000fea', '꽃사레', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '103');
INSERT INTO public.vendors VALUES ('e1339714-5569-4908-a65c-3628e7f8e151', '나래꽃', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '102');
INSERT INTO public.vendors VALUES ('6c57b77b-119a-4e2e-afcb-b4f4f495032f', '향기꽃나라', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '101');
INSERT INTO public.vendors VALUES ('b63c2de1-2725-4d27-b601-e796c7cb43cf', '주연원예', '52af90a8-6444-47de-9bdc-1e5e1e067702', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '98-2');
INSERT INTO public.vendors VALUES ('efbf4620-b37c-49f8-a693-2cca594a7859', '선미원예', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '235');
INSERT INTO public.vendors VALUES ('c8969e39-eea3-4648-a3f1-102ba85e9974', '신플라워', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '180');
INSERT INTO public.vendors VALUES ('f8c34081-ce08-451d-b8f8-4b8402833858', '아름원예', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '131');
INSERT INTO public.vendors VALUES ('86dd8047-6206-464b-acbe-2f8ce36f5f54', '꽃길', '480e88b0-954e-4083-8081-caf4f46d811d', 'not_supported', '2026-01-05 14:24:28.622269+00', NULL, '121');


--
-- Data for Name: receipts; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.receipts VALUES ('08b87681-33af-41f9-bbb9-5cf370f22866', 'a1aaeeac-f5df-4f14-b490-69aff49aaa72', '0e2b5e0c-cbca-4769-8180-82b63d18076c', NULL, 45000, 'cash', 'standard', 'uploaded', NULL, 'a1aaeeac-f5df-4f14-b490-69aff49aaa72/0e2b5e0c-cbca-4769-8180-82b63d18076c/1768224912538.jpg', NULL, '2026-01-12 13:35:15.13609+00');


--
-- PostgreSQL database dump complete
--

\unrestrict EI6Zs1na4fYYJ9boGIRkuOZwe1G3JRtfFqVyZ4VnwTA5I6zK0fOMAU2wsugXV7c

