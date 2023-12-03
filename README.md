# aws-lambda-probe

## features

* HTTP 이벤트 출력
    * APIGatewayProxyEventV2
        * 일부 민감한 정보는 숨김
    * Context
* AWS Lambda 런타임에 포함된 AWS SDK for JavaScript v3 정보
    * AWS SDK 버전 (공식 문서에 포함됨)
    * 실제로 설치된 패키지 목록 (공식 문서에 없음)
* 환경 변수 출력
    * 일부 민감한 정보는 숨김

## 기준 환경
* region: ap-northeast-1
* runtime: nodejs20.x
* architecture: arm64
