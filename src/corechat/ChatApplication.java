package corechat;


import java.util.ArrayList;
import java.util.InputMismatchException;
import java.util.Scanner;

public class ChatApplication {


    static Scanner scanner = new Scanner(System.in);


    ArrayList<User> users = new ArrayList<>();
    User currentUser = null;
    MessageManager manager = new MessageManager();
    ChatService chatService;


    public static void main(String[] args) {


        ChatApplication app = new ChatApplication();

        System.out.println("==========================");
        System.out.println("        CORE CHAT         ");
        System.out.println("==========================");
        System.out.println();

        System.out.println("Welcome to CoreChat!");
        System.out.println("\nStarting Application...\n");

        int choice = 0;
        boolean valid;

        while (true) {

            System.out.println("---------Menu---------");
            System.out.println("1. Register ");
            System.out.println("2. Login ");
            System.out.println("3. Exit\n");

            valid = false;

            while (!valid) {
                try {
                    System.out.print("Enter your choice : ");
                    choice = scanner.nextInt();
                    scanner.nextLine();
                    valid = true;


                    System.out.println("--------------------------");
                } catch (InputMismatchException e) {
                    System.out.println("\n-> Invalid choice :( ");
                    System.out.println();
                    scanner.nextLine();
                }
            }

            if (choice == 3) {
                System.out.println("Exiting CoreChat...");
                break;
            }

            switch (choice) {


                case 1 -> {
                    System.out.println("You selected Register.\n");
                    app.registerUser();


                }

                case 2 -> {

                    System.out.println("You selected Login.\n");
                    boolean loginSuccess = app.userLogin();

                    if (loginSuccess) {
                        app.chatService = new ChatService(
                                app.currentUser,
                                app.users,
                                app.manager
                        );
                        app.chatMenu();
                    }
                }


                default -> System.out.println("Please enter a valid choice.\n");
            }
        }
    }

    public void registerUser() {
        System.out.print("Enter Username : ");
        String name = scanner.nextLine().toLowerCase();

        User user = new User(name);
        users.add(user);

        System.out.println("registration completed !! ");
        System.out.println("\nHello : " + user.getUserName() + "\n");

    }


    public boolean userLogin() {
        String name;

        System.out.print("Enter user name : ");
        name = scanner.nextLine().toLowerCase();


        // User register or not logic

        for (int i = 0; i < users.size(); i++) {
            if (name.equals(users.get(i).getUserName())) {
                System.out.println("\nLogin Successfully \n");
                currentUser = users.get(i);
                System.out.println("Welcome , " + currentUser.getUserName());
                return true;
            }

        }
        System.out.println("\nPlease Register first !!");
        System.out.println();

        return false;
    }

    public void chatMenu() {

        boolean valid;
        while (true) {
            System.out.println("========================");
            System.out.println("       CHAT MENU        ");
            System.out.println("========================\n");


            System.out.println("1. Chats ");
            System.out.println("2. Log Out \n");


            int choice = 0;
            valid = false;

            while (!valid) {
                try {
                    System.out.print("Enter your choice : ");
                    choice = scanner.nextInt();
                    scanner.nextLine();
                    valid = true;

                } catch (InputMismatchException e) {
                    System.out.println("\n-> Invalid valid choice :(");
                    scanner.nextLine();
                    System.out.println();


                }
            }

            System.out.println("-----------------------\n");

            if (choice == 2) {
                System.out.println("Thanks for using :) !\n");
                currentUser = null;
                chatService = null;
                break;
            }

            switch (choice) {

                case 1 -> {
                    System.out.println(" Chats !!\n");
                    chatService.chats();

                }
                default -> System.out.println("Enter a valid choice !!\n");

            }

        }
    }

}




