package corechat;

public class Message {

    private User sender;
    private User receiver;
    private String messageContent;

    Message(User sender , User receiver , String messageContent){
        this.sender = sender;
        this.receiver = receiver;
        this.messageContent = messageContent;
    }

    public  User getSender(){
        return this.sender;
    }

    public User getReceiver(){
        return this.receiver;
    }

    public String getMessage(){
        return this.messageContent;
    }
}
