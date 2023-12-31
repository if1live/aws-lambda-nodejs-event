# websocket

## $connect

```
$ wscat -c "wss://abcdefghij.execute-api.ap-northeast-1.amazonaws.com/dev?status=200"
Connected (press CTRL+C to quit)
>

$ wscat -c "wss://abcdefghij.execute-api.ap-northeast-1.amazonaws.com/dev?status=201"
Connected (press CTRL+C to quit)
>

$ wscat -c "wss://abcdefghij.execute-api.ap-northeast-1.amazonaws.com/dev?status=301"
error: Unexpected server response: 301
>

$ wscat -c "wss://abcdefghij.execute-api.ap-northeast-1.amazonaws.com/dev?status=401"
error: Unexpected server response: 401
>

$ wscat -c "wss://abcdefghij.execute-api.ap-northeast-1.amazonaws.com/dev?status=501"
error: Unexpected server response: 501
>

$ wscat -c "wss://abcdefghij.execute-api.ap-northeast-1.amazonaws.com/dev?exc=foo"
error: Unexpected server response: 502
>
```

1. status === 2xx: `Connected`
2. status !== 2xx: `error: Unexpected server response: {status}`
    * [wscat에서 yellow message](https://github.com/websockets/wscat/blob/48de976ce0c4b3af1ceea64880df4ea010d72ad4/bin/wscat#L222)
    * `ws.on('error')` 로 진입한다. disconnect가 아니다!
3. exception: `error: Unexpected server response: 502`

## $default

```
$ wscat -c "wss://abcdefghij.execute-api.ap-northeast-1.amazonaws.com/dev"
Connected (press CTRL+C to quit)
> status:200
> status:201
> status:301
> status:401
> status:501
> exc:foo
< {"message": "Internal server error", "connectionId":"Qyi07eCbtjMCJKw=", "requestId":"Qyi3UG41tjMFlUg="}
> exc:bar
< {"message": "Internal server error", "connectionId":"Qyi07eCbtjMCJKw=", "requestId":"Qyi3jGF9NjMFoqA="}
> hello
< hello
>
```

1. status code는 웹소켓 연결에 영향을 주지 않는다.
2. exception 발생시 json 리턴한다. 웹소켓 연결에는 영향을 주지 않는다.
